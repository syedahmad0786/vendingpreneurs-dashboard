# Modern Amenities Onboarding Dashboard — Technical Reference

Complete system architecture, every account / API key / URL, every cron and webhook, and a deep troubleshooting manual. For engineering.

---

## 1. Top-level architecture

```
                  ┌─────────────────────────────────────────────────┐
                  │                  USER BROWSER                    │
                  │   v0-vendingpreneurs-dashboard.vercel.app        │
                  └─────────────────────┬───────────────────────────┘
                                        │  /api/onboarding/pipeline
                                        │  polls every 8s
                                        ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                  Vercel · Next.js 16 (App Router)                       │
   │                  v0-vendingpreneurs-dashboard                           │
   │ ─────────────────────────────────────────────────────────────────────── │
   │  /api/onboarding/pipeline   →  reads Clients + Onboarding Errors        │
   │  /api/onboarding/notify     →  busts caches + kicks sweep               │
   │  /api/onboarding/resubmit-all  →  proxies to n8n resubmit-onboarding    │
   │  /api/onboarding/errors/resolve →  marks Airtable error rows Resolved   │
   │  /api/verify/sweep          →  parallel MN + Intercom + Close per lead  │
   │  /api/verify/mighty-networks → MN Admin API per email                   │
   │  /api/verify/intercom       →  Intercom contacts API per email          │
   │  /api/verify/close          →  Close lead query per email               │
   │  /api/supabase/sync         →  full Airtable → Supabase upsert          │
   │  /api/supabase/sync-lead    →  single-lead resync                       │
   │  /api/airtable/refresh-webhooks → 7-day webhook rotation                │
   │  /api/webhooks/clerk-vendhub → Clerk → Airtable (read-only)             │
   │  /api/platforms/gaps        →  Cross-platform view backend              │
   │  /api/stats / /api/onboarding/verify / etc                              │
   └──┬──────────────┬──────────────┬──────────────┬──────────────┬─────────┘
      │              │              │              │              │
      ▼              ▼              ▼              ▼              ▼
  ┌────────┐   ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
  │Airtable│   │  Supabase  │  │   MN     │  │ Intercom │  │     Close    │
  │  base  │   │ Postgres   │  │ Admin API│  │contacts  │  │   /lead/?q   │
  │appgqED…│   │tvgutachaub │  │api.mn.co │  │ api      │  │              │
  └────┬───┘   └────────────┘  └──────────┘  └──────────┘  └──────────────┘
       │
       ▼  Airtable change webhooks (per-table)
  ┌──────────────────┐
  │ /api/onboarding  │  ← Airtable POSTs here on Clients + Errors changes
  │     /notify      │
  └──────────────────┘

  Other inbound:
  ┌──────────────────┐
  │ Clerk (VendHub)  │  user.created, session.created, invitation.* etc
  │  webhook → /api/ │
  │  webhooks/clerk- │
  │     vendhub      │
  └──────────────────┘

  External-cron senders:
  ┌──────────────────┐
  │      n8n         │  every 5 min: /api/supabase/sync
  │ aimanagingservices  every 5 min: VendHub Activated Users sheet ingest
  │     .com         │
  └──────────────────┘
```

---

## 2. Hosts and accounts

### Production live URLs

| What | URL |
|---|---|
| **Live dashboard** | https://v0-vendingpreneurs-dashboard.vercel.app |
| **GitHub repo** | https://github.com/syedahmad0786/vendingpreneurs-dashboard |
| **Vercel project** | ahmad-bukharis-projects-74a52414/v0-vendingpreneurs-dashboard |
| **Airtable base** | https://airtable.com/appgqED05AlPLi0ar |
| **Supabase project** | https://tvgutachaubmjgnuyizs.supabase.co |
| **n8n** | https://n8n.aimanagingservices.com |

### Vercel project

- Account: `ahmad-bukharis-projects-74a52414`
- Project: `v0-vendingpreneurs-dashboard`
- Plan: **Hobby** (note: cron limited to once-per-day per entry)
- Deployment URL alias: `v0-vendingpreneurs-dashboard.vercel.app`
- CLI deploy: `vercel deploy --prod --yes` (from repo root)

### GitHub

- Owner: `syedahmad0786`
- Repo: `vendingpreneurs-dashboard`
- Default branch: `master`
- Auto-deploy: not configured — Vercel deploys are CLI-driven

### Airtable

- Base id: `appgqED05AlPLi0ar`
- Tables in use:
  | Name | Table id | Purpose |
  |---|---|---|
  | Clients | `tblwDucKYAsPDVBA2` | Primary read source. Active client roster. |
  | Student Onboarding | `tblMLFYTeoqrtmgXQ` | Legacy data, still mirrored for compatibility. |
  | Onboarding Errors | `tblaQ6fpHGhRs56sH` | n8n logs failures here. Status field drives the dashboard's red-error strip. |
  | Mighty Networks Full Client List | `tblsXziNpIge64fEK` | MN member ledger linked from Clients via `Mighty Networks Full Client List` field. |
  | VendHub Data Sync | (linked from Clients via `VendHub Data Sync`) | Source of `in_vendhub` truth. |
- PAT scope: Personal Access Token with all-bases read/write. Stored in Vercel env as `AIRTABLE_PAT`.

### Supabase

- Project ref: `tvgutachaubmjgnuyizs`
- Region: ap-south-1 (Mumbai)
- DB name: `postgres`
- Pooler host: `aws-1-ap-south-1.pooler.supabase.com:6543`
- Pooler user: `postgres.tvgutachaubmjgnuyizs`
- Service role JWT (for PostgREST): stored in Vercel as `SUPABASE_SERVICE_ROLE_KEY`
- Tables / views in use:
  | Name | Purpose |
  |---|---|
  | `leads` | Cross-platform lead table — one row per email |
  | `platform_presence` | (lead_id, platform) → status + external_id |
  | `vw_lead_full` | Lead joined with status enums |
  | `vw_platform_gaps` | Gaps view — drives Cross-platform tab |

### n8n self-hosted

- Host: `n8n.aimanagingservices.com`
- API key: stored separately (rotates) — used to manage workflows via the API
- Credentials stored inside n8n (NOT in this repo):
  - Airtable Token: cred id `R7CZf7GZvAyib012` (named "N8N Token For Airtable")
  - Intercom Account: cred id `t09KtQT6c8ZI1PcR` (named "Intercom account")
  - Close CRM, Google Sheets, Slack, etc. — each managed in n8n
- Active workflows the dashboard depends on:
  | Workflow id | Name | Triggers |
  |---|---|---|
  | `mFju07ubpmgYok3H` | New Student Onboarding (with Mighty Networks) | Inbound from Close on lead-won |
  | `a4pYUsEul9qNgzmC` | Resubmit Student Onboarding (with mighty network) | webhook `resubmit-onboarding` |
  | `LWOHszGSSaRUsQXk` | MA — Verify: VendHub All | every 5 min from Google Sheet |
  | `8DPfJUedpEVYeVCt` | MA — Verify: Intercom All | legacy hourly sweep |
  | `5diZVZy2hUIrrSzk` | MA — Resubmit: Mighty Networks | webhook `ma-resubmit-mn` |
  | `KQCzXkeX7e5Wns4C` | MA — Resubmit: Intercom | webhook `ma-resubmit-intercom` |
  | `pty6MP4Yv8PVmpWe` | MA — Resubmit: Close CRM | webhook `ma-resubmit-close` |
  | `nhflprWyhqr3axdr` | MA — Resubmit: Email Validation | webhook `ma-resubmit-email` |
  | `OqYb4T9BEB9Oh3Yx` | MA — Resubmit: VendHub (PLACEHOLDER) | webhook `ma-resubmit-vendhub` |

### Mighty Networks

- Network id: `21685656` (community.vendingpreneurs.com)
- API base: `https://api.mn.co`
- API key prefix: `mn_…` (stored as `MN_API_KEY`)
- API spec: https://api.mn.co/admin/v1/spec.json
- Endpoint we use: `GET /admin/v1/networks/{network_id}/members/by_email?email=`
- Rate limit: 100 req/min (Standard plan)

### Intercom

- Workspace: `arysd9vj` (vendhub) — derived from `clerk.vendhubhq.com` workspace
- Stored as `INTERCOM_ACCESS_TOKEN` (Bearer)
- API base: `https://api.intercom.io`
- API version header: `Intercom-Version: 2.10`
- Endpoint we use: `POST /contacts/search`
- Rate limit: 1,000 req/min default

### Close CRM

- Org: Vendingpreneurs (43,248 leads as of last audit)
- API base: `https://api.close.com/api/v1`
- Auth: Basic (api_key as username, no password)
- Stored as `CLOSE_API_KEY`
- Endpoint we use: `GET /lead/?query=email_address:<email>&_fields=id`
- Rate limit: ~40 req/sec per org

### VendHub

- Marketing host: `www.vendhubhq.com`
- App routes (Clerk-gated): `/dashboard`, `/operators`, `/users`, `/orgs`, `/machines`
- Auth: Clerk
- Clerk Frontend API: `clerk.vendhubhq.com`
- Clerk Publishable Key: `pk_live_Y2xlcmsudmVuZGh1YmhxLmNvbSQ` (just identifies the host — NOT a backend secret)
- Clerk Secret Key (sk_live_…): NOT on file. Only the webhook signing secret is needed.
- **Important: this dashboard NEVER writes to VendHub or Clerk.** Read-only via webhooks.

### Clerk webhook (for VendHub event ingestion)

- Webhook URL configured in Clerk dashboard: `https://v0-vendingpreneurs-dashboard.vercel.app/api/webhooks/clerk-vendhub`
- Signing secret env var: `CLERK_VENDHUB_WEBHOOK_SECRET` (whsec_…)
- Subscribed events: `user.created`, `user.updated`, `session.created`, `email.created`, `organizationInvitation.{created,accepted,revoked}`, `organizationMembership.created`

---

## 3. Vercel environment variables

All set on Production environment.

| Var | Purpose |
|---|---|
| `AIRTABLE_PAT` | Airtable Personal Access Token, all-bases r/w |
| `AIRTABLE_BASE_ID` | `appgqED05AlPLi0ar` |
| `SUPABASE_URL` | `https://tvgutachaubmjgnuyizs.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role JWT — used by `/api/supabase/*` |
| `CRON_SECRET` | Shared secret for cron-only endpoints — header `x-cron-secret` |
| `N8N_BASE_URL` | `https://n8n.aimanagingservices.com` |
| `MN_API_KEY` | Mighty Networks Admin API key (`mn_…`) |
| `MN_NETWORK_ID` | `21685656` |
| `INTERCOM_ACCESS_TOKEN` | Intercom Bearer token |
| `CLOSE_API_KEY` | Close CRM API key |
| `CLERK_VENDHUB_WEBHOOK_SECRET` | (Set after Clerk dashboard webhook setup) |
| `NEXT_PUBLIC_INTERCOM_APP_ID` | (optional) workspace id for deep links |
| `NEXT_PUBLIC_VENDHUB_HOST` | (optional) override for VendHub deep links — default `www.vendhubhq.com` |
| `NEXT_PUBLIC_VENDHUB_USER_PATH` | (optional) override — default `operators` |
| `NEXT_PUBLIC_VENDHUB_ORG_PATH` | (optional) override — default `organizations` |
| `NEXT_PUBLIC_MN_COMMUNITY_HOST` | (optional) override — default `community.vendingpreneurs.com` |
| `NEXT_PUBLIC_AIRTABLE_BASE_ID` | (optional) used by client-side deep links |

---

## 4. Crons (Vercel Hobby — once-per-day each entry)

Defined in `vercel.json`. Effective every-6-hours via 4 separate entries hitting the same path.

| Path | Schedule (UTC) |
|---|---|
| `/api/verify/sweep` | `0 0 * * *` (00:00) |
| `/api/verify/sweep` | `0 6 * * *` (06:00) |
| `/api/verify/sweep` | `0 12 * * *` (12:00) |
| `/api/verify/sweep` | `0 18 * * *` (18:00) |
| `/api/airtable/refresh-webhooks` | `30 6 * * *` (06:30) |

**Plus n8n-driven (not Vercel cron):**

| Workflow | Cadence | Action |
|---|---|---|
| `MA — Verify: VendHub All` | every 5 min | Reads VendHub Activated Users Google Sheet → updates Airtable |
| `MA Sync Airtable → Supabase` (n8n cron) | every 5 min | POSTs `/api/supabase/sync` |

---

## 5. Webhooks

### Outbound from this dashboard

None except for the n8n resubmit chain (we POST to n8n's webhook URLs to trigger workflows).

### Inbound to this dashboard

| Source | URL | Auth |
|---|---|---|
| **Airtable Clients table change** | `/api/onboarding/notify` | None (cache-bust only — no risk) |
| **Airtable Errors table change** | `/api/onboarding/notify` | None |
| **Clerk events (VendHub onboarding)** | `/api/webhooks/clerk-vendhub` | Svix-signature with `CLERK_VENDHUB_WEBHOOK_SECRET` |
| **n8n manual triggers** | `/api/onboarding/notify`, etc. | None / cron secret depending on path |

Airtable webhooks expire after 7 days. The cron at 06:30 UTC daily refreshes them automatically (`/api/airtable/refresh-webhooks`).

### Outbound to n8n (the dashboard fires these)

| Webhook | Used for |
|---|---|
| `/webhook/resubmit-onboarding` | "Resubmit all platforms" button — full pipeline rerun |
| `/webhook/ma-resubmit-close` | Per-step retry — Close stage |
| `/webhook/ma-resubmit-email` | Per-step retry — Email validation |
| `/webhook/ma-resubmit-mn` | Per-step retry — Mighty Networks |
| `/webhook/ma-resubmit-intercom` | Per-step retry — Intercom |
| `/webhook/ma-resubmit-vendhub` | Per-step retry — VendHub (placeholder) |
| `/webhook/ma-verify-all` | Bulk verify all platforms |
| `/webhook/ma-verify-intercom-direct` | Standalone Intercom verifier (disabled) |

---

## 6. Data flow — how a new lead lands and gets visible

```
1. Sales rep wins a deal in Close CRM
   └─► Close fires opportunity.won
       └─► n8n workflow `New Student Onboarding (with Mighty Networks)`
           ├─ Validates email
           ├─ Creates Airtable Clients row  ◄── tblwDucKYAsPDVBA2
           ├─ Sends Mighty Networks invite
           ├─ Creates Intercom contact
           └─ Adds to VendHub Activated Users Google Sheet

2. Airtable change webhook fires (Clients table changed)
   └─► POST /api/onboarding/notify
       ├─ Busts in-memory caches (clients, studentOnboarding, errors)
       └─ fire-and-forget POST /api/verify/sweep { newestN: 20 }
           └─► /api/verify/sweep runs in parallel:
               ├─ /api/verify/mighty-networks (max 20)
               ├─ /api/verify/intercom (max 20)
               └─ /api/verify/close (max 20)
           Each verifier:
           ├─ Pulls Clients rows missing this platform's id
           ├─ For each email, calls platform API
           └─ PATCHes Airtable with the result

3. n8n VendHub workflow's next 5-min cycle
   └─► Reads activated-users sheet
       └─► Sets `in_vendhub`=true on the Clients row

4. Next dashboard poll (every 8s)
   └─► /api/onboarding/pipeline reads Airtable
       ├─ Classifier emits per-stage status from real platform fields
       └─ Returns to browser → new lead visible with full status
```

End-to-end visibility: **~10 seconds** for Close + Intercom + Mighty Networks; up to 5 min for VendHub.

---

## 7. Real-time triggers (anything-to-dashboard latency)

| Source event | Path | Latency to dashboard |
|---|---|---|
| User clicks Retry / Resubmit / Mark Resolved | Inline cache bust | ~3s |
| Airtable Clients row changed | Airtable webhook → /api/onboarding/notify | ~10s |
| Airtable Errors row changed | Airtable webhook → /api/onboarding/notify | ~10s |
| Clerk VendHub event | /api/webhooks/clerk-vendhub | ~10s (after secret is configured) |
| n8n verifier workflow finished | Workflow's final HTTP node calls /notify | ~10s |
| Daily verifier cron (00 / 06 / 12 / 18 UTC) | Vercel cron | Same poll cycle |

---

## 8. Cache layers and TTLs

| Layer | TTL | Bust on |
|---|---|---|
| In-memory Airtable response cache (`src/lib/cache.ts`) | 8s | `/api/onboarding/notify`, `invalidateTableCache()`, every retry/resolve action |
| Browser `/api/onboarding/pipeline` cache | none | every poll re-fetches |
| Supabase | n/a (Postgres) | upserted by `/api/supabase/sync` every 5 min |
| Vercel CDN | varies | Next.js `dynamic = "force-dynamic"` on API routes |

Dashboard polls `/api/onboarding/pipeline` every 8s. With cache TTL 8s + Airtable webhook firing on changes, end-to-end latency is **3–10 seconds** in steady-state.

---

## 9. Endpoint reference

### Read endpoints

| Path | Auth | Returns |
|---|---|---|
| `GET /api/onboarding/pipeline?fresh=1` | none | Full lead list with classifier output |
| `GET /api/stats` | none | Aggregated counters |
| `GET /api/platforms/gaps?bucket=…` | none | Cross-platform view backend |

### Mutation / proxy endpoints

| Path | Auth | What it does |
|---|---|---|
| `POST /api/onboarding/resubmit` | none (called from dashboard) | Per-step retry — proxies to n8n `ma-resubmit-*` webhook |
| `POST /api/onboarding/resubmit-all` | none | Full pipeline rerun — proxies to n8n `resubmit-onboarding` |
| `POST /api/onboarding/errors/resolve` | none | Marks Onboarding Errors rows Resolved |
| `POST /api/onboarding/resolve-all` | none | Bulk-resolves every open error |
| `POST /api/onboarding/notify` | none | Cache bust + sweep kick |

### Verifier endpoints

| Path | Auth | What it does |
|---|---|---|
| `POST /api/verify/sweep` | `x-cron-secret` | Calls all 3 verifiers in parallel for one email or newest N rows |
| `POST /api/verify/mighty-networks` | `x-cron-secret` | MN Admin API per email, writes Airtable |
| `POST /api/verify/intercom` | `x-cron-secret` | Intercom contacts/search per email |
| `POST /api/verify/close` | `x-cron-secret` | Close `/lead/?query=email_address:` per email, active-only mode |

### Supabase sync endpoints

| Path | Auth | What it does |
|---|---|---|
| `POST /api/supabase/sync` | `x-cron-secret` | Full Airtable → Supabase upsert |
| `POST /api/supabase/sync-lead` | none | Single-lead resync (fast path after retry/resolve) |

### Webhook receivers

| Path | Auth | What it does |
|---|---|---|
| `POST /api/webhooks/clerk-vendhub` | Svix-signature | Reads VendHub Clerk events, writes Airtable + Supabase |

### Maintenance

| Path | Auth | What it does |
|---|---|---|
| `POST /api/airtable/refresh-webhooks` | `x-cron-secret` | Recreates Airtable change webhooks before 7-day expiry |

---

## 10. Source code map

```
src/
├── app/
│   ├── page.tsx                    Pipeline page (Kanban + Table + Real-errors strip)
│   ├── api/
│   │   ├── onboarding/
│   │   │   ├── pipeline/route.ts   GET classifier output
│   │   │   ├── resubmit/route.ts   per-step retry proxy
│   │   │   ├── resubmit-all/route.ts full-pipeline retry proxy
│   │   │   ├── errors/resolve/route.ts mark error Resolved
│   │   │   ├── resolve-all/route.ts bulk resolve
│   │   │   ├── notify/route.ts      cache bust + sweep
│   │   │   └── verify/route.ts      legacy "verify all" proxy
│   │   ├── verify/
│   │   │   ├── sweep/route.ts       parallel-fan-out verifier
│   │   │   ├── mighty-networks/route.ts MN Admin API verifier
│   │   │   ├── intercom/route.ts    Intercom verifier
│   │   │   └── close/route.ts       Close verifier
│   │   ├── supabase/
│   │   │   ├── sync/route.ts        full Airtable → Supabase
│   │   │   └── sync-lead/route.ts   single-lead resync
│   │   ├── airtable/
│   │   │   └── refresh-webhooks/route.ts 7-day rotation
│   │   ├── webhooks/
│   │   │   └── clerk-vendhub/route.ts read-only Clerk ingestion
│   │   ├── platforms/gaps/route.ts  Cross-platform backend
│   │   └── stats/route.ts           summary counters
│   ├── clients/page.tsx             Clients tab
│   ├── leads/page.tsx               Legacy
│   ├── quality, revenue, national   Coming-soon stubs
│   └── settings/page.tsx
├── components/
│   ├── design/
│   │   ├── DashboardShell.tsx       TopBar + SubBar + KPIStrip + IntegrationsRail
│   │   ├── Board.tsx                Kanban (LeadCard inside)
│   │   ├── LeadDrawer.tsx           Right-side detail drawer
│   │   ├── LeadsTableView.tsx       Table view
│   │   ├── NewErrorsView.tsx        Full-page New errors tab
│   │   ├── RealErrorsStrip.tsx      Inline strip on Pipeline page
│   │   ├── CrossPlatformView.tsx    "Who's on what" matrix
│   │   ├── Views.tsx                OperatorsView, ErrorsView, AnalyticsView
│   │   ├── PlatformLogos.tsx        Branded platform icons
│   │   ├── DashboardIcons.tsx       Lucide-like UI icons
│   │   └── Charts.tsx               BarChart, DonutChart, AreaTrend, Sparkline
│   └── pipeline/                    Older variants
├── lib/
│   ├── pipeline.ts                  Core classifier + LeadPipeline types
│   ├── airtable.ts                  Airtable fetch + cache
│   ├── airtable-to-supabase.ts      Supabase upsert builder
│   ├── supabase.ts                  PostgREST helper
│   ├── platform-links.ts            Deep-link URL builders
│   ├── design-adapter.ts            LeadPipeline → DesignLead transform
│   └── cache.ts                     In-memory cache
└── ...
```

Public assets:
```
public/brand/
├── close.svg
├── airtable.svg
├── intercom.svg
├── email.svg
├── vendhub.svg
├── mighty.avif
└── modern-amenities-{horizontal,icon}{,-white}.png
```

---

## 11. Local development

```bash
git clone https://github.com/syedahmad0786/vendingpreneurs-dashboard
cd vendingpreneurs-dashboard
npm install
cp .env.example .env.local   # then fill in the values from Vercel env
npm run dev                  # http://localhost:3000

# Typecheck:
./node_modules/.bin/tsc --noEmit

# Deploy to prod:
vercel deploy --prod --yes
```

Runtime: Node 20+, Next.js 16 App Router, TypeScript strict.

---

## 12. Troubleshooting

### Symptom: dashboard shows stale data

1. **Hard refresh** the browser tab. Cmd+Shift+R / Ctrl+Shift+R.
2. **Check the notify endpoint:** `curl https://v0-vendingpreneurs-dashboard.vercel.app/api/onboarding/notify` — should return `ok: true`.
3. **Check Airtable webhooks are alive:**
   ```bash
   curl https://api.airtable.com/v0/bases/appgqED05AlPLi0ar/webhooks -H "Authorization: Bearer $AIRTABLE_PAT" | jq '.webhooks | length'
   ```
   Should return `2`. If `0`, run:
   ```bash
   curl -X POST https://v0-vendingpreneurs-dashboard.vercel.app/api/airtable/refresh-webhooks -H "x-cron-secret: $CRON_SECRET"
   ```
4. **Check the in-memory cache:** API routes log to Vercel. Look at the deployment logs in the Vercel dashboard → Deployments → most recent → Logs.

### Symptom: a lead is missing from the dashboard

1. **Active filter ON?** A cancelled / inactive client is hidden by default. Toggle "Active only" to OFF to see them.
2. **Email match?** The dashboard joins by email. If their Personal Email differs from Mighty Networks email, MN looks "missing." Check the Airtable Clients row.
3. **Brand-new (last minute)?** Wait 30 seconds. If still missing, hit notify:
   ```bash
   curl -X POST https://v0-vendingpreneurs-dashboard.vercel.app/api/onboarding/notify \
     -H "content-type: application/json" \
     -d '{"email":"that@person.com"}'
   ```

### Symptom: VendHub stage shows "missing" but customer is active

1. **Check Google Sheet:** Open the VendHub Activated Users sheet. Is their email there?
2. **Check `in_vendhub` field on the Clients row** — should be ✓.
3. **If `in_vendhub` is NOT set,** the n8n VendHub workflow hasn't synced yet. Force-trigger:
   ```bash
   curl -X POST https://n8n.aimanagingservices.com/webhook/ma-verify-vendhub
   ```

### Symptom: Mighty Networks shows "missing" for a member

1. **Direct API check:**
   ```bash
   curl "https://api.mn.co/admin/v1/networks/21685656/members/by_email?email=their@email.com" \
     -H "Authorization: Bearer $MN_API_KEY"
   ```
   - If 200 with member data → the verifier hasn't run for them. Trigger:
     ```bash
     curl -X POST https://v0-vendingpreneurs-dashboard.vercel.app/api/verify/mighty-networks \
       -H "x-cron-secret: $CRON_SECRET" \
       -H "content-type: application/json" \
       -d '{"email":"their@email.com"}'
     ```
   - If 404 → they really aren't in MN. Check the Airtable Clients email matches their MN email.

### Symptom: Intercom shows "missing" for a contact

Same pattern as MN above, but:
```bash
curl -X POST "https://api.intercom.io/contacts/search" \
  -H "Authorization: Bearer $INTERCOM_ACCESS_TOKEN" \
  -H "Intercom-Version: 2.10" \
  -H "Content-Type: application/json" \
  -d '{"query":{"field":"email","operator":"=","value":"their@email.com"}}'
```

### Symptom: Resubmit button errors out

1. **Check n8n is up:**
   ```bash
   curl -I https://n8n.aimanagingservices.com/
   ```
2. **Check the resubmit-onboarding webhook is registered:**
   ```bash
   curl -X POST https://n8n.aimanagingservices.com/webhook/resubmit-onboarding \
     -H "content-type: application/json" -d '{"_test":true}'
   ```
   Should return 200 (workflow accepted) or 200 with workflow output. If 404, the workflow is inactive — log into n8n and toggle it.
3. **Check workflow execution** in n8n: workflow `a4pYUsEul9qNgzmC` → Executions tab → most recent.

### Symptom: Cron isn't running

1. Vercel dashboard → project → **Settings → Cron Jobs**. Check Schedule + Last Invoked.
2. If a cron is failing silently, check **Deployments → Logs** filtered to the cron path. Hobby cron logs may be limited; consider Pro for richer cron observability.
3. Force-run a cron manually:
   ```bash
   curl -X POST https://v0-vendingpreneurs-dashboard.vercel.app/api/verify/sweep \
     -H "x-cron-secret: $CRON_SECRET"
   ```

### Symptom: Supabase sync failing

1. **Auth:**
   ```bash
   curl https://tvgutachaubmjgnuyizs.supabase.co/rest/v1/leads?select=count \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
   ```
   Should return `[{"count": 1851}]` or similar.
2. **Schema drift:** if the syncer fails with `column not found`, run the migration:
   ```sql
   ALTER TABLE leads
     ADD COLUMN IF NOT EXISTS mn_member_id text,
     ADD COLUMN IF NOT EXISTS intercom_contact_id text;
   ```

### Symptom: Airtable webhook stops firing

7-day expiry. The 06:30 UTC daily cron should refresh, but if it's missed:
```bash
curl -X POST https://v0-vendingpreneurs-dashboard.vercel.app/api/airtable/refresh-webhooks \
  -H "x-cron-secret: $CRON_SECRET"
```

### Symptom: Clerk webhook returns 401

Check `CLERK_VENDHUB_WEBHOOK_SECRET` in Vercel env starts with `whsec_`. If you rotated the Clerk endpoint signing secret, update Vercel env and redeploy.

### Symptom: Logos broken / 404

Confirm:
```bash
for f in close.svg airtable.svg intercom.svg email.svg vendhub.svg mighty.avif; do
  curl -sS -o /dev/null -w "/brand/$f: HTTP %{http_code}\n" \
    https://v0-vendingpreneurs-dashboard.vercel.app/brand/$f
done
```

If any return 404, check the file exists in `public/brand/` on the deployed branch.

### Where the logs live

| Layer | Where |
|---|---|
| Vercel API routes | https://vercel.com/ahmad-bukharis-projects-74a52414/v0-vendingpreneurs-dashboard/deployments → Functions |
| n8n executions | n8n.aimanagingservices.com → workflow → Executions tab |
| Airtable activity | Airtable base → record history (per row) |
| Supabase queries | https://supabase.com/dashboard/project/tvgutachaubmjgnuyizs/logs |
| Clerk webhook deliveries | https://dashboard.clerk.com → vendhubhq → Webhooks → endpoint → Recent Deliveries |

---

## 13. Security model

- All Airtable / MN / Intercom / Close credentials are **server-only** env vars on Vercel — never exposed to the client.
- `CRON_SECRET` gates all verifier endpoints in production (header `x-cron-secret`).
- Clerk webhook is Svix-signature verified.
- Supabase RLS is enabled; only the service role key can write.
- Dashboard endpoints that mutate Airtable (`/api/onboarding/errors/resolve`, etc) are open by default — they only act on data the user already has UI access to. Move behind auth if the dashboard ever becomes externally accessible.

---

## 14. Known limitations

| Limit | Reason | Workaround |
|---|---|---|
| Crons run max once-per-day per entry | Vercel Hobby plan | Multiple entries to same path at different hours (currently 4 per day per sweep path) |
| MN Admin API rate-limited 100/min Standard | Mighty Networks plan | Verifier sleeps 700ms between calls; 429-aware retry/backoff |
| Verifier function max 60s on Hobby | Vercel Hobby function timeout | Each verifier bails before 55s; chained polls finish the rest |
| Airtable webhook 7-day expiry | Airtable platform | Daily refresh cron |

---

## 15. Migration / handoff

To transfer ownership to client / company accounts:

1. **GitHub:** Settings → Transfer ownership → enter org/user.
2. **Vercel:** Settings → Transfer Project → choose target team.
3. **Airtable, Supabase, n8n, Clerk:** Already client-owned — nothing to move.
4. **Update env vars** if any keys differ on the receiving Vercel team.

After transfer, redeploy and run `/api/airtable/refresh-webhooks` once to ensure webhooks point at the new (or same) URL.

---

## 16. Owner & support

- Built by **Ahmad Bukhari** · ahmadbukhari4245@gmail.com · [github.com/syedahmad0786](https://github.com/syedahmad0786)
- Issues / change requests: GitHub Issues on the repo.
- For urgent prod incidents: ping Ahmad directly.

---

*This document is the single source of technical truth for this dashboard. If something here is out of date with reality, the running code wins — please update this doc.*
