#!/usr/bin/env python3
"""
Mighty Networks → Supabase syncer.

Lists every member from the MN API and upserts as leads + presence.
Catches MN-only members (people who are in the community but never made it
into Close/Airtable).

Env vars:
  MN_API_KEY       Mighty Networks Bearer token
  MN_NETWORK_ID    e.g. vendingpreneurs (or numeric)
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""
from __future__ import annotations
import os, sys, json, time, urllib.parse, urllib.request

MN_KEY = os.environ["MN_API_KEY"]
MN_NETWORK_ID = os.environ.get("MN_NETWORK_ID", "")
SUPA_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPA_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DRY = "--dry" in sys.argv


def supa_rpc(fn: str, payload: dict):
    if DRY: return None
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


def list_members(page: int = 1, per_page: int = 100):
    qs = {"page": page, "per_page": per_page}
    if MN_NETWORK_ID:
        qs["network_id"] = MN_NETWORK_ID
    url = f"https://api.mightynetworks.com/api/v1/members?{urllib.parse.urlencode(qs)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {MN_KEY}", "Accept": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    started = time.time()
    page = 1
    total = 0
    while True:
        try:
            res = list_members(page)
        except urllib.error.HTTPError as e:
            print(f"MN API error page {page}: {e.code}")
            break
        members = res.get("data") or res.get("members") or []
        if not members:
            break
        for m in members:
            email = (m.get("email") or m.get("email_address") or "").strip().lower()
            if not email:
                continue
            lead_id = supa_rpc("upsert_lead", {
                "p_email": email,
                "p_full_name": m.get("name") or m.get("full_name"),
                "p_mn_member_id": str(m.get("id") or ""),
            })
            status = "member" if m.get("status") in ("active", "member") else "invited"
            supa_rpc("upsert_presence", {
                "p_lead_id": lead_id,
                "p_platform": "mighty",
                "p_status": status,
                "p_external_id": str(m.get("id") or ""),
                "p_joined_at": m.get("joined_at") or m.get("created_at"),
                "p_raw": {"name": m.get("name"), "status": m.get("status")},
            })
            total += 1
        print(f"  ... page {page}, {total} members")
        if len(members) < 100:
            break
        page += 1
        time.sleep(0.3)

    print(f"Synced {total} MN members in {round((time.time()-started)*1000)}ms")


if __name__ == "__main__":
    main()
