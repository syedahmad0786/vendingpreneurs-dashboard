#!/usr/bin/env python3
"""
Intercom → Supabase syncer.

Fetches every Intercom contact (paginated) and upserts as leads + presence.
Catches Intercom-only contacts (people who exist in Intercom but never made
it into Airtable / Close).

Env vars:
  INTERCOM_TOKEN              Bearer token (Settings → Developers → Access tokens)
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""
from __future__ import annotations
import os, sys, json, time, urllib.request

INTERCOM_TOKEN = os.environ["INTERCOM_TOKEN"]
SUPA_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPA_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DRY = "--dry" in sys.argv

HEADERS_IC = {
    "Authorization": f"Bearer {INTERCOM_TOKEN}",
    "Intercom-Version": "2.10",
    "Accept": "application/json",
}


def supa_rpc(fn: str, payload: dict):
    if DRY:
        return None
    req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/rpc/{fn}",
        data=json.dumps(payload).encode(),
        headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{fn}: {e.code} {e.read().decode()[:200]}")


def list_contacts(starting_after: str | None = None):
    url = "https://api.intercom.io/contacts"
    if starting_after:
        url += f"?starting_after={starting_after}&per_page=150"
    else:
        url += "?per_page=150"
    req = urllib.request.Request(url, headers=HEADERS_IC)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    started = time.time()
    cursor = None
    total = 0
    while True:
        page = list_contacts(cursor)
        for c in page.get("data", []):
            email = (c.get("email") or "").strip().lower()
            if not email:
                continue
            lead_id = supa_rpc("upsert_lead", {
                "p_email": email,
                "p_full_name": c.get("name"),
                "p_intercom_id": c.get("id"),
            })
            # User vs lead role: 'user' = confirmed, 'lead' = unconfirmed visitor
            role = c.get("role", "lead")
            status = "member" if role == "user" else "invited"
            joined_at = None
            if c.get("created_at"):
                joined_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(c["created_at"]))
            supa_rpc("upsert_presence", {
                "p_lead_id": lead_id,
                "p_platform": "intercom",
                "p_status": status,
                "p_external_id": c.get("id"),
                "p_joined_at": joined_at,
                "p_raw": {"role": role, "external_id": c.get("external_id")},
            })
            total += 1

        pages = page.get("pages", {})
        next_cursor = pages.get("next", {}).get("starting_after") if pages.get("next") else None
        print(f"  ... {total} synced (next cursor: {bool(next_cursor)})")
        if not next_cursor:
            break
        cursor = next_cursor
        time.sleep(0.4)  # gentle on rate limits

    print(f"Synced {total} Intercom contacts in {round((time.time()-started)*1000)}ms")


if __name__ == "__main__":
    main()
