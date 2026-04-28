# Clerk → VendHub webhook setup

Read-only ingestion of VendHub onboarding events into the Modern Amenities
dashboard. **No writes are made to Clerk or VendHub** — every event we
receive results in a PATCH to the Airtable Clients + Student Onboarding
tables and a Supabase nudge.

## What this powers

The VendHub stage on the dashboard pipeline becomes real-time:
- "VendHub User ID" populated from `user.created`
- "VendHub Verified At" populated from `user.created` and accepted invites
- "VendHub Last Sign In" from `session.created` (= activation)
- "VendHub Email Verified" from `email.created` and `user.updated`
- "VendHub Invite Status" from `organizationInvitation.{created,accepted,revoked}`
- "VendHub Invited At" from `organizationInvitation.created`

## Setup (one time, takes 3 minutes)

### 1. Add webhook endpoint in Clerk Dashboard

Open https://dashboard.clerk.com → select the **vendhubhq** instance →
**Webhooks** → **Add Endpoint**.

- Endpoint URL: `https://v0-vendingpreneurs-dashboard.vercel.app/api/webhooks/clerk-vendhub`
- Description: `Modern Amenities onboarding pipeline`
- Subscribe to events:
  - `user.created`
  - `user.updated`
  - `session.created`
  - `email.created`
  - `organizationInvitation.created`
  - `organizationInvitation.accepted`
  - `organizationInvitation.revoked`
  - `organizationMembership.created`

Click **Create**.

### 2. Copy the signing secret

Clerk shows a secret that starts with `whsec_…`. Copy it.

### 3. Add to Vercel env

```bash
echo "whsec_..." | vercel env add CLERK_VENDHUB_WEBHOOK_SECRET production --token <your_token>
```

Or via the Vercel dashboard: Project → Settings → Environment Variables →
add `CLERK_VENDHUB_WEBHOOK_SECRET` with the `whsec_…` value, scope =
Production.

### 4. Redeploy

```bash
vercel deploy --prod --token <your_token> --yes
```

Once redeployed, the next event Clerk fires will land on the dashboard.

## Verify

GET the webhook URL — it reports its own config without sending anything:

```
GET https://v0-vendingpreneurs-dashboard.vercel.app/api/webhooks/clerk-vendhub
{
  "ok": true,
  "handler": "clerk-vendhub",
  "secretConfigured": true,    ← should flip to true after step 3+4
  "expectedHeaders": [...],
  "handledEvents": [...]
}
```

In Clerk Dashboard → Webhooks → your endpoint → **Testing** tab, send a test
`user.created` event. You should see HTTP 200 with a JSON body summarizing
what got patched.

## Safety notes

- The handler **rejects events** without a valid `svix-signature` once
  `CLERK_VENDHUB_WEBHOOK_SECRET` is set.
- Replay protection: events older than 5 minutes are rejected.
- `session.created` only stamps "VendHub Last Sign In" — it does NOT
  create new Airtable rows. Activation is inferred only by matching the
  Clerk `user_id` to an existing Airtable row's `VendHub User ID`.
- The handler **never** calls back into Clerk or VendHub.

## Troubleshooting

If the webhook returns 401 "Invalid signature":
- Confirm the secret in Vercel env exactly matches what Clerk shows
  (start `whsec_`, no whitespace).
- Confirm the latest deploy includes the env var: visit the GET endpoint,
  `secretConfigured` should be `true`.

If events arrive but Airtable rows aren't updated:
- The handler matches by email. If the Clerk user's primary email differs
  from what's in Airtable, no row will be patched. Check the response body
  of the webhook event in Clerk's "Recent Deliveries" tab — `tablesUpdated`
  shows how many rows were touched.
