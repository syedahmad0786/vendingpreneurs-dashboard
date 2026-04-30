# Modern Amenities Dashboard — User Guide

For the Sales and CSM teams.

**Where to find it:** https://v0-vendingpreneurs-dashboard.vercel.app

This is the home of every Vendingpreneurs client and where they are in onboarding — Close CRM, email, Airtable, Mighty Networks, Intercom, VendHub. One screen, one truth.

---

## How quickly does the data update?

This is important — read this once, then trust the dashboard to be live.

| What changed | When you'll see it on the dashboard |
|---|---|
| You hit Retry / Resubmit / Mark Resolved on a row | **~3 seconds** |
| Someone edits the Clients table in Airtable | **~10 seconds** |
| A new error fires from the n8n workflow | **~10 seconds** |
| A new lead just signed up (Airtable row created) | **~10–30 seconds** for Close + Intercom + Mighty Networks; up to 5 minutes for VendHub |
| Mighty Networks / Close / Intercom backstop sync | **Every 6 hours** (00:00, 06:00, 12:00, 18:00 UTC) |
| VendHub sync from the activated-users Google Sheet | **Every 5 minutes** |
| Page itself polls for fresh data while you have it open | **Every 8 seconds** |

**The dashboard is not stale.** If something looks wrong, hit **Refresh** in the top-right and give it 10 seconds. If it still looks wrong, check the troubleshooting list at the bottom of this doc.

---

## The top bar — top to bottom

### Active only toggle (default ON)

The little green chip at the top right that says "Active only".

- **ON** (default, recommended): hides cancelled / expired clients. The dashboard shows you only the people who matter — currently paying clients plus anyone who signed up in the last 3 days.
- **OFF**: shows everyone in Airtable, including cancelled and refunded customers.

Click it to flip. You'll see the count change instantly: "(active/total)".

### REP filter

Pick a sales REP from the dropdown to see only their clients. "All owners" shows everyone.

### Refresh

Forces an immediate refresh. You almost never need this — the dashboard auto-refreshes every 8 seconds — but it's there if you want to be sure.

### Search bar (top right of header)

Type a company name, contact name, or email. Filters the board / table in real time.

### Page navigation (Pipeline / Clients / New errors / Errors & retries / Cross-platform / Analytics)

| Tab | What it's for |
|---|---|
| **Pipeline** | The default view. Shows the full onboarding journey for every active client — cards (Kanban) or rows (Table). |
| **Clients** | A clean sortable list of every client, like a CRM contact list. |
| **New errors** | Full-page version of the red error strip on the Pipeline page. Real workflow errors only. |
| **Errors & retries** | Older "all errors" view including the platform-missing classifications. Useful for the Retry workflow. |
| **Cross-platform** | "Who's on what." Shows every client and which of the 5 platforms they're on. ✓ green = on the platform (clickable to open the record). ✗ red = not yet. |
| **Analytics** | Charts. Funnel conversion, error trends, REP leaderboards. |

---

## The Pipeline page

### KPI strip — the four big numbers

| Number | What it means |
|---|---|
| **Total** | Active clients (matches the toggle). |
| **In flight** | Currently moving through the pipeline. |
| **Stuck** | Real errors that need a human to look at them. |
| **Live** | Successfully onboarded — fully on every platform. |
| **Waiting on customer** | Customer hasn't completed their part yet (e.g. accept Mighty Networks invite). |

### Pipeline stages · live status (the row of stage tiles)

Six stages in order: **Close CRM → Email validation → Airtable → Mighty Networks → Intercom → VendHub.**

Each tile shows the count of leads at that stage in three buckets:
- ✅ **Success** count — fully on this platform
- ⚠️ **Error** count — real failure logged from n8n
- ⏳ **Pending** count — still moving, no error yet

Click a number to drill into the leads in that bucket. Click the eye icon to peek at the first 5.

### Real workflow errors strip (red banner, only when there are errors)

This is the **only true error list**. Anything here came from the n8n New Student Onboarding workflow blowing up. Each row has:

- **Resubmit** button (gold) — fires the same n8n workflow that the Airtable "Resubmit Onboarding" button uses. On success, the error row is auto-marked Resolved and the lead disappears from this list.
- **Details** button — opens the lead drawer for full info.

If the strip is hidden, **there are no real errors right now** — that's the green-state.

### Kanban ↔ Table toggle (Pipeline page)

Top-right of the toolbar.

- **Kanban**: classic columns. Each column is a stage, each card is a lead. Drag-free (cards advance automatically as the data updates).
- **Table**: every lead in one sortable list. Best for spotting patterns — "show me everyone missing 2+ platforms." Default sort is "most missing platforms first."

### Filter chips above the board

- **All** — everyone (within the active-only toggle)
- **In flight** — currently processing
- **Waiting on customer** — invited, customer hasn't accepted
- **Errors** — anything flagged red
- **Live** — fully onboarded

You can also click any **stage tile** to filter to that stage.

---

## What every color means

### Lead card colors

| Border color | Meaning |
|---|---|
| **Green** | Live — fully onboarded |
| **Gold / amber outline** | New (last 3 days, still being verified) |
| **Yellow / yellow chip** | Waiting on customer to accept invite or finish a step |
| **Red** | Real error — n8n workflow failure logged |
| **Blue / animated dot** | Currently processing (in flight) |

### Status pill (right side of every card)

- 🟢 **Done** — onboarded
- 🔴 **Error** — n8n failure logged
- 🟡 **Waiting** — waiting on customer
- 🔵 **Live** — actively processing
- 🟡 **New · Waiting** — added in last 3 days

### Cross-platform tab

- **● green dot** — confirmed on platform; click to open the record on that platform
- **○ red ring** — not yet on platform

### Table view (Pipeline → Table)

Same dot meaning as Cross-platform. The "Missing" column shows count, red if ≥ 2 missing.

### Stage statuses (in the lead drawer)

- ✅ **Success** — confirmed on this platform
- ❌ **Error** — workflow failed; needs Resubmit or manual fix
- ⏳ **Pending** — verification hasn't run yet (give it 10s after a new lead lands)
- 🟡 **Waiting for customer** — invite sent, waiting for them to accept

---

## "Why does it say missing for someone I know is active?"

99% of the time it's one of these:

1. **Brand-new lead, less than 1 minute old.** The verifiers run within 10 seconds of an Airtable row landing — give it half a minute.
2. **Email mismatch.** The dashboard matches by email. If their Mighty Networks email differs from the Airtable Personal Email, MN looks "missing." Check both emails on the lead drawer.
3. **VendHub sheet hasn't synced yet.** The activated-users Google Sheet syncs every 5 min. Brand-new VendHub activations show within 5 min.
4. **You're not seeing the latest deploy.** Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows).

If it's been more than 10 minutes and the data is still wrong → ping the engineering team.

---

## Quick task cheat-sheet

| I want to … | Where |
|---|---|
| See everything that's actively broken | **Pipeline page · Real workflow errors strip** at top |
| Resubmit a lead through the whole pipeline | Click **Resubmit** on the red strip OR on the **New errors** tab |
| Find leads stuck on a single stage (e.g. all "missing Intercom") | **Cross-platform** tab → click the column header |
| See who's an error vs who's just slow | Look at **status pill** color — red = real error, yellow = waiting |
| Pull all my own clients | **REP filter** at top-right |
| Compare Mighty Networks success rate by REP | **Analytics** tab |
| Open a record on the platform itself | Click the **platform icon** on a card or in the Cross-platform table |

---

## Buttons — what each one does

| Button | What happens |
|---|---|
| **Retry** | Re-runs the failed step only (just Mighty, just Intercom, etc). Use when you know which step failed. |
| **Resubmit all platforms** | Re-runs the full onboarding pipeline. Use for ghost leads (no Clients row yet) or stubborn errors. |
| **Mark resolved** | Closes the error in Airtable without actually fixing the underlying problem. Use when you've manually fixed it elsewhere. |
| **Mark all errors resolved** | Bulk-clears every error currently shown. Confirm-dialog protects against accidents. Use after a major incident is over. |
| **Open in [platform]** | Opens the customer's record directly in Close / Mighty / Intercom / VendHub. |
| **Open VendHub dashboard** | Lands you in VendHub when we don't have a direct user link yet. |
| **Refresh** | Forces a fresh fetch from Airtable. Almost never needed — the dashboard auto-polls every 8s. |

---

## When to involve engineering

Dashboard does not show what you expect AND:
- Hard refresh didn't fix it
- It's been 10+ minutes since the change
- Multiple leads show the same wrong thing (not just one)

→ Ping engineering with: the lead's email, what you expect, what you see, screenshot.

For platform credential issues (Intercom token expired, MN API key revoked, Close key rotated) — engineering only. The dashboard does not have a UI for credential management.

---

*Last updated: this is auto-generated and ships with every dashboard release. If the screen looks different from this doc, the dashboard wins — let engineering know so we can update.*
