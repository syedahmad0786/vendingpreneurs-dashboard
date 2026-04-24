#!/usr/bin/env python3
"""
Airtable → Supabase syncer (bulk version).

Fetches every Student Onboarding row and upserts into Supabase using
PostgREST bulk upsert (merge-duplicates). Takes ~30 seconds for 2000 rows.
"""
from __future__ import annotations
import os, sys, json, time, urllib.parse, urllib.request

AIRTABLE_PAT = os.environ["AIRTABLE_PAT"]
AIRTABLE_BASE = os.environ["AIRTABLE_BASE_ID"]
TABLE_ID = "tblMLFYTeoqrtmgXQ"
SUPA_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPA_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DRY = "--dry" in sys.argv

FIELDS = [
    "Full Name", "Best Email", "Client ID", "Program Tier Purchased",
    "Sales Rep", "Create Date", "Last Modified Time (All Fields)",
    "Was Email sent", "MN Invite Granted", "MN Invite ID", "MN Verified",
    "Intercom Synced At", "Intercome Failed?", "Intercom Verified",
    "VendHub Status", "VendHub Organization", "VendHub User ID",
    "Archived",
]


def airtable_get(offset=None):
    qs = [("fields[]", f) for f in FIELDS]
    if offset: qs.append(("offset", offset))
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{TABLE_ID}?{urllib.parse.urlencode(qs)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {AIRTABLE_PAT}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def supa_bulk_upsert(table: str, on_conflict: str, rows: list[dict]) -> int:
    """Bulk upsert with merge-duplicates. Returns rows affected."""
    if not rows: return 0
    if DRY:
        print(f"  [dry] upsert {len(rows)} rows into {table}")
        return len(rows)
    url = f"{SUPA_URL}/rest/v1/{table}?on_conflict={on_conflict}"
    req = urllib.request.Request(
        url,
        data=json.dumps(rows).encode(),
        headers={
            "apikey": SUPA_KEY,
            "Authorization": f"Bearer {SUPA_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            r.read()
        return len(rows)
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:500]
        raise RuntimeError(f"Supabase {table} HTTP {e.code}: {body}")


def supa_select_all(table: str, select_cols: str = "*") -> list[dict]:
    """Select all from a table (for lookup)."""
    url = f"{SUPA_URL}/rest/v1/{table}?select={select_cols}&limit=10000"
    req = urllib.request.Request(
        url,
        headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def truthy(v):
    if v is None or v == "": return False
    if isinstance(v, bool): return v
    if isinstance(v, str):
        s = v.strip().lower()
        return s not in ("0", "no", "false", "n", "not sent")
    if isinstance(v, (int, float)): return v != 0
    return bool(v)


def main():
    t0 = time.time()
    print("Fetching Airtable rows...")
    rows = []
    offset = None
    while True:
        page = airtable_get(offset)
        rows.extend(page.get("records", []))
        offset = page.get("offset")
        if not offset: break
    print(f"  → {len(rows)} rows fetched in {round((time.time()-t0)*1000)}ms")

    # Build lead-payload list (dedupe by lowercased email)
    seen_emails = {}
    skipped_no_email = 0
    for r in rows:
        f = r.get("fields", {})
        email = (f.get("Best Email") or "").strip().lower()
        if not email:
            skipped_no_email += 1
            continue
        cid = f.get("Client ID") or ""
        row = {
            "email": email,
            "full_name": f.get("Full Name"),
            "program_tier": f.get("Program Tier Purchased"),
            "sales_rep": f.get("Sales Rep"),
            "close_lead_id": cid if cid.startswith("lead_") else None,
            "airtable_id": r["id"],
            "mn_invite_id": str(f.get("MN Invite ID")) if f.get("MN Invite ID") else None,
            "vendhub_user_id": f.get("VendHub User ID"),
            "vendhub_org": f.get("VendHub Organization"),
        }
        # If duplicate email, keep the one with more data (prefer one with close_lead_id)
        existing = seen_emails.get(email)
        if existing is None or (row["close_lead_id"] and not existing["close_lead_id"]):
            seen_emails[email] = row
        # Remember the raw Airtable fields keyed by email for presence pass
        seen_emails[email]["_raw"] = f
        seen_emails[email]["_airtable_id"] = r["id"]

    leads_to_upsert = list(seen_emails.values())
    leads_clean = [{k: v for k, v in r.items() if not k.startswith("_")} for r in leads_to_upsert]
    print(f"\nUpserting {len(leads_clean)} leads into Supabase...")
    t1 = time.time()
    BATCH = 500
    for i in range(0, len(leads_clean), BATCH):
        chunk = leads_clean[i:i+BATCH]
        supa_bulk_upsert("leads", "email", chunk)
        print(f"  ... {i + len(chunk)}/{len(leads_clean)}")
    print(f"  → leads upserted in {round((time.time()-t1)*1000)}ms")

    # Get lead ids by email
    print("\nLooking up lead ids by email...")
    t2 = time.time()
    lead_rows = supa_select_all("leads", "id,email")
    id_by_email = {r["email"]: r["id"] for r in lead_rows}
    print(f"  → {len(id_by_email)} leads indexed in {round((time.time()-t2)*1000)}ms")

    # Build presence rows — every row MUST have the same keys (PostgREST
    # rejects bulk inserts with heterogeneous keys). Use null for missing.
    def presence(lead_id, platform, status, external_id=None, joined_at=None, invited_at=None, failed_at=None):
        return {
            "lead_id": lead_id,
            "platform": platform,
            "status": status,
            "external_id": external_id,
            "joined_at": joined_at,
            "invited_at": invited_at,
            "failed_at": failed_at,
        }

    presences: list[dict] = []
    for row in leads_to_upsert:
        email = row["email"]
        lead_id = id_by_email.get(email)
        if not lead_id:
            continue
        f = row["_raw"]

        # Airtable presence — 'member' when row exists, 'missing' if archived
        presences.append(presence(
            lead_id, "airtable",
            "missing" if truthy(f.get("Archived")) else "member",
            external_id=row["_airtable_id"],
            joined_at=f.get("Create Date"),
        ))

        # Close
        if (f.get("Client ID") or "").startswith("lead_"):
            presences.append(presence(
                lead_id, "close", "member",
                external_id=f["Client ID"],
            ))

        # Mighty
        mn_verified = (f.get("MN Verified") or "").lower()
        mn_status = None
        if mn_verified in ("member", "joined", "active"):
            mn_status = "member"
        elif truthy(f.get("MN Invite Granted")) or truthy(f.get("MN Invite ID")):
            mn_status = "invited"
        if mn_status:
            presences.append(presence(
                lead_id, "mighty", mn_status,
                external_id=str(f.get("MN Invite ID")) if f.get("MN Invite ID") else None,
            ))

        # Intercom
        ic_verified = f.get("Intercom Verified") or ""
        ic_status = None
        if ic_verified == "Verified":
            ic_status = "member"
        elif truthy(f.get("Intercom Synced At")):
            ic_status = "invited"
        elif truthy(f.get("Intercome Failed?")):
            ic_status = "failed"
        if ic_status:
            presences.append(presence(
                lead_id, "intercom", ic_status,
                invited_at=f.get("Intercom Synced At"),
            ))

        # VendHub
        vh = (f.get("VendHub Status") or "").upper()
        vh_status = {"ACTIVE": "member", "PENDING": "invited", "CANCELED": "failed", "NOT FOUND": "missing"}.get(vh)
        if vh_status:
            presences.append(presence(
                lead_id, "vendhub", vh_status,
                external_id=f.get("VendHub User ID"),
            ))

    print(f"\nUpserting {len(presences)} presence rows...")
    t3 = time.time()
    for i in range(0, len(presences), BATCH):
        chunk = presences[i:i+BATCH]
        supa_bulk_upsert("platform_presence", "lead_id,platform", chunk)
        print(f"  ... {i + len(chunk)}/{len(presences)}")
    print(f"  → presences upserted in {round((time.time()-t3)*1000)}ms")

    # Log sync run
    supa_bulk_upsert("sync_runs", "id", [{
        "platform": "airtable",
        "records_in": len(rows),
        "records_upserted": len(leads_clean),
        "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "duration_ms": round((time.time()-t0)*1000),
    }])

    print(f"\nDone in {round(time.time()-t0, 1)}s. leads={len(leads_clean)}, presences={len(presences)}, skipped no-email={skipped_no_email}")


if __name__ == "__main__":
    main()
