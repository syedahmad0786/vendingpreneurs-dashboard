#!/usr/bin/env python3
"""
Close CRM → Supabase syncer (Modern Amenities).

Fetches every Close lead matching our criteria (paginated 100 at a time
via /api/v1/lead/) and upserts them into Supabase.

Env vars:
  CLOSE_API_KEY        Close API key (Settings → Developer → API Keys)
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Usage:
  python3 sync_close.py
  python3 sync_close.py --query "smart_view_id:..."   # filter
  python3 sync_close.py --dry
"""
from __future__ import annotations
import os, sys, json, time, base64, urllib.parse, urllib.request

CLOSE_KEY = os.environ["CLOSE_API_KEY"]
SUPA_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPA_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DRY = "--dry" in sys.argv
QUERY = next((sys.argv[i+1] for i, a in enumerate(sys.argv) if a == "--query" and i+1 < len(sys.argv)), None)

CLOSE_AUTH = "Basic " + base64.b64encode(f"{CLOSE_KEY}:".encode()).decode()


def close_get(skip: int = 0, limit: int = 100):
    qs = {"_skip": skip, "_limit": limit, "_fields": "id,display_name,contacts,custom,date_created,status_label"}
    if QUERY:
        qs["query"] = QUERY
    url = f"https://api.close.com/api/v1/lead/?{urllib.parse.urlencode(qs)}"
    req = urllib.request.Request(url, headers={"Authorization": CLOSE_AUTH})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def supa_rpc(fn: str, payload: dict):
    if DRY:
        return f"<dry:{fn}>"
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
        body = e.read().decode()[:300]
        raise RuntimeError(f"Supabase {fn} HTTP {e.code}: {body}")


def main():
    started = time.time()
    skip = 0
    total = 0
    while True:
        page = close_get(skip)
        leads = page.get("data", [])
        if not leads:
            break
        for lead in leads:
            cid = lead["id"]
            display = lead.get("display_name") or ""
            contacts = lead.get("contacts", [])
            # Take the first email across all contacts
            email = None
            for c in contacts:
                for em in c.get("emails", []):
                    if em.get("email"):
                        email = em["email"].lower().strip()
                        break
                if email: break
            if not email:
                continue
            lead_id = supa_rpc("upsert_lead", {
                "p_email": email,
                "p_full_name": display,
                "p_close_lead_id": cid,
            })
            supa_rpc("upsert_presence", {
                "p_lead_id": lead_id,
                "p_platform": "close",
                "p_status": "member",
                "p_external_id": cid,
                "p_joined_at": lead.get("date_created"),
                "p_raw": {"display_name": display, "status_label": lead.get("status_label")},
            })
            total += 1
        skip += len(leads)
        print(f"  fetched {skip}…")
        if not page.get("has_more"):
            break
        time.sleep(0.2)

    print(f"Synced {total} Close leads in {round((time.time()-started)*1000)}ms")


if __name__ == "__main__":
    main()
