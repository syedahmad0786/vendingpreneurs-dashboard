# Real-time dashboard updates

The dashboard now reflects Airtable changes within **~10 seconds** of them
happening — without anyone clicking refresh.

## How it works

Two layers:

1. **Client polling.** The dashboard polls `/api/onboarding/pipeline` every
   **8 seconds** while the page is open. Cheap (~300ms per call) and the
   in-memory cache keeps Airtable load low.

2. **Cache busting on demand.** Anything that changes Airtable can POST to
   `https://v0-vendingpreneurs-dashboard.vercel.app/api/onboarding/notify`
   to invalidate the dashboard's in-memory caches immediately. The next
   client poll then fetches fresh data, so changes appear in under 10
   seconds even when n8n workflows fire mid-poll-cycle.

## Wire n8n workflows to fire the notify ping

Add an HTTP node at the end of every workflow that touches Airtable. About
1 minute per workflow.

### Step-by-step

1. Open n8n workflow (e.g. `MA — Error Reporter`).
2. After the node that writes to Airtable, add a new **HTTP Request** node:
   - **Method:** POST
   - **URL:** `https://v0-vendingpreneurs-dashboard.vercel.app/api/onboarding/notify`
   - **Authentication:** none
   - **Body Content Type:** JSON
   - **JSON Body:**
     ```json
     {
       "reason": "error_logged",
       "email": "={{ $json['Email'] }}",
       "source": "n8n:ma-error-reporter"
     }
     ```
3. Save and activate.

### Workflows that should ping notify

| n8n workflow | Reason | Where to add |
|---|---|---|
| `MA — Error Reporter` | `error_logged` | After the Airtable Create node |
| `MA — Verify: Intercom All` | `verify_complete` | After the final Airtable Update node |
| `MA — Verify: VendHub All` | `verify_complete` | After the final Airtable Update node |
| `MA — Verify All Platforms` | `verify_complete` | After the Resolve Errors node |
| `MA — Auto-Add Missing to Intercom` | `client_added` | After the Intercom Create + Airtable Update |
| `New Student Onboarding (with Mighty Networks)` | `client_added` | After the row is added to Clients |

The dashboard's own routes (`/api/onboarding/resubmit`, `/api/onboarding/errors/resolve`)
already invalidate caches inline, so retry/resolve actions are
near-instant without any wiring.

## Other systems that already fire notify

- **Clerk webhook** (`/api/webhooks/clerk-vendhub`) busts cache + nudges Supabase
  on every event it receives. So VendHub onboarding events hit the dashboard
  in real time.

## Verifying it works

After wiring an n8n node, trigger the workflow once. Watch:

1. Network tab in browser DevTools on the dashboard page → next
   `/api/onboarding/pipeline` request after the n8n run shows the change.
2. Or `curl https://v0-vendingpreneurs-dashboard.vercel.app/api/onboarding/notify`
   directly to confirm the endpoint responds.

## Cost / load

- Notify ping: ~30ms, no Airtable read.
- Single-lead Supabase resync (fired async if `email` is in the body): ~1.5s.
- Dashboard poll: ~300ms hitting the cached endpoint, ~1s on a cold cache.

Worst case (e.g. 50 dashboard sessions open + an n8n workflow logging an
error): one Airtable read + 50 cached responses + one Supabase upsert.
Total < 2 seconds of compute.
