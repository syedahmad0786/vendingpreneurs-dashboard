# Modern Amenities — n8n Resubmit Workflows

This folder contains the per-step resubmit workflows that power the "Retry"
buttons on the Modern Amenities Onboarding Pipeline dashboard.

All workflows target **`https://n8n.aimanagingservices.com/`**. Each file in
this directory is a standalone importable workflow.

## Webhook paths

| Step                | Webhook URL                                                                 | Status |
|---------------------|-----------------------------------------------------------------------------|--------|
| Close CRM           | `POST https://n8n.aimanagingservices.com/webhook/ma-resubmit-close`         | Ready  |
| Email Validation    | `POST https://n8n.aimanagingservices.com/webhook/ma-resubmit-email`         | Ready (set your validator API key in the HTTP node) |
| Mighty Networks     | `POST https://n8n.aimanagingservices.com/webhook/ma-resubmit-mn`            | Ready  |
| Intercom            | `POST https://n8n.aimanagingservices.com/webhook/ma-resubmit-intercom`      | Ready  |
| VendHub             | `POST https://n8n.aimanagingservices.com/webhook/ma-resubmit-vendhub`       | **Placeholder** — replace stub when VendHub details land |
| Verify All Platforms | `POST https://n8n.aimanagingservices.com/webhook/ma-verify-all` *(also runs every 15 min)* | Ready — requires MN + Intercom credentials assigned |

## Verify All Platforms

`ma-verify-all-platforms.json` is a single workflow that reconciles the dashboard
state with reality every 15 minutes. For each Student Onboarding record it:

1. Calls **Mighty Networks** `GET /members/lookup?email=` and classifies the response as
   `Member`, `Invited`, or `Not Found` (falls back to on-record MN Invite ID if the
   API returns nothing).
2. Calls **Intercom** `POST /contacts/search` with the lead's email; classifies as
   `Verified` or `Not Found`.
3. Writes `MN Verified` / `MN Verified At` and `Intercom Verified` / `Intercom Verified At`
   on the Student Onboarding row.
4. When a platform confirms membership, finds any open `Onboarding Errors` row for that
   step and marks it `Resolved` with a note "Auto-resolved by MA Verify All Platforms".

The dashboard reads these Verified fields directly in `src/lib/pipeline.ts` so the
board automatically shifts a lead from "error" to "Member" once reality catches up.

## Request body

Every workflow expects the same shape (posted by `src/app/api/onboarding/resubmit/route.ts`):

```json
{
  "leadRecordId": "rec...",            // Airtable Student Onboarding record id (required)
  "errorRecordId": "rec...",           // Airtable Onboarding Errors record id (optional)
  "step": "close_crm",                 // matching step slug (for logging)
  "context": {
    "fullName": "...",
    "email": "...",
    "clientId": "lead_...",
    "programTier": "Silver - $8,997"
  },
  "triggeredAt": "2026-04-23T14:30:00Z",
  "source": "dashboard_resubmit"
}
```

## Response shape

Each workflow responds with JSON that the dashboard surfaces as a toast:

```json
{ "success": true,  "step": "close_crm", "leadRecordId": "rec..." }
{ "success": false, "step": "close_crm", "message": "<reason>" }
```

## Installation

1. In n8n, go to **Workflows → Import from File** and select each JSON in this folder.
2. For each imported workflow, open it and assign credentials to the nodes that need them:
   - **Airtable** nodes → "Airtable Token" (Personal Access Token).
   - **Close CRM** HTTP Request → "Close CRM API" predefined credential.
   - **Mighty Networks** HTTP Request → HTTP Header Auth credential named "Mighty Networks API".
   - **Intercom** node → "Intercom OAuth" credential.
   - **Email validation** HTTP Request → replace `REPLACE_ME` with your Abstract API key (or swap for Mailgun/NeverBounce).
3. Activate the workflow (`Active` toggle).
4. Confirm the webhook path matches the table above.

## Security

The dashboard sends an `X-Webhook-Secret` header if `N8N_WEBHOOK_SECRET` is
configured on the Vercel project. You can validate it inside each workflow by
adding an IF node at the top:

```
{{ $request.headers['x-webhook-secret'] === $env.MA_WEBHOOK_SECRET }}
```

## Legacy `/webhook/resubmit-onboarding`

The existing single-endpoint workflow is still used as a fallback if a
per-step webhook isn't yet active. Do not delete it; the dashboard falls back
gracefully.

## VendHub placeholder

`ma-resubmit-vendhub.json` is a stub that returns `{"success": false, "message": "VendHub integration not yet configured"}`. When the Modern Amenities team shares the VendHub API details, replace the `Respond 501 Not Implemented` node with an HTTP Request that hits the account-provisioning endpoint, then add Airtable update nodes like the other workflows.
