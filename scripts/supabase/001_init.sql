-- =====================================================================
-- Modern Amenities — Cross-Platform Lead Truth (v1)
--
-- Run once on a fresh Supabase project:
--   1. supabase.com → New Project (region: US East)
--   2. SQL Editor → paste this file → Run
--   3. Settings → API → copy Project URL + service_role key
--   4. Share with Claude; we'll wire the syncers.
-- =====================================================================

-- Reset (safe on a new project; comment out if you have prod data).
-- Drops happen in dependency order: functions → views → tables → types.
-- `cascade` on types is a belt-and-braces guarantee in case anything else
-- still references them.
drop function if exists upsert_lead(text, text, text, text, text, text, text, text, text, text, text);
drop function if exists upsert_presence(uuid, platform_t, presence_status_t, text, timestamptz, timestamptz, timestamptz, jsonb);
drop view if exists vw_platform_gaps;
drop view if exists vw_lead_full;
drop table if exists events;
drop table if exists sync_runs;
drop table if exists platform_presence;
drop table if exists leads;
drop type if exists platform_t cascade;
drop type if exists presence_status_t cascade;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type platform_t as enum ('close', 'airtable', 'mighty', 'intercom', 'vendhub');

-- Status of this lead WITHIN this platform:
--   member   = confirmed active (joined MN, active VendHub, etc.)
--   invited  = invite/sync sent, waiting on customer to act
--   failed   = the platform rejected the lead (hard error)
--   missing  = we've checked and the lead is genuinely not present
--   unknown  = never checked yet
create type presence_status_t as enum ('member', 'invited', 'failed', 'missing', 'unknown');

-- ---------------------------------------------------------------------
-- leads — one row per unique human (dedupe key = lowercased email)
-- Filled from whichever platform we saw them in first. Close CRM wins
-- for authoritative contact data if we have it.
-- ---------------------------------------------------------------------
create table leads (
  id              uuid primary key default gen_random_uuid(),
  email           text unique,          -- lowercased, trimmed
  full_name       text,
  program_tier    text,
  sales_rep       text,
  -- Canonical ids from each platform for deep-links
  close_lead_id   text,                 -- lead_xxx from Close
  airtable_id     text,                 -- recxxx from Student Onboarding
  mn_member_id    text,                 -- Mighty Networks member id
  mn_invite_id    text,                 -- MN invite id (if only invited)
  intercom_id     text,                 -- Intercom contact id
  vendhub_user_id text,                 -- VendHub user id from sheet
  vendhub_org     text,                 -- VendHub organization name
  -- Timestamps
  first_seen_at   timestamptz default now(),
  last_seen_at    timestamptz default now(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index leads_email_idx on leads(lower(email));
create index leads_close_idx on leads(close_lead_id);
create index leads_updated_idx on leads(updated_at desc);

-- ---------------------------------------------------------------------
-- platform_presence — one row per (lead, platform) observation
-- The unique constraint (lead_id, platform) gives us upsert semantics:
-- on each sync we update status/raw_payload for that lead+platform pair.
-- ---------------------------------------------------------------------
create table platform_presence (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references leads(id) on delete cascade,
  platform       platform_t not null,
  status         presence_status_t not null default 'unknown',
  external_id    text,                        -- platform-native id
  joined_at      timestamptz,                 -- when they actually became a member
  invited_at     timestamptz,                 -- when invite went out
  failed_at      timestamptz,                 -- when we logged the failure
  last_checked_at timestamptz default now(),
  raw            jsonb,                       -- full platform payload for debugging
  unique (lead_id, platform)
);
create index presence_platform_status_idx on platform_presence(platform, status);
create index presence_lead_idx on platform_presence(lead_id);

-- ---------------------------------------------------------------------
-- sync_runs — append-only log so we can see when each platform was last
-- synced and how many records came in.
-- ---------------------------------------------------------------------
create table sync_runs (
  id           uuid primary key default gen_random_uuid(),
  platform     platform_t not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  records_in   int default 0,
  records_upserted int default 0,
  errors       int default 0,
  error_text   text,
  duration_ms  int
);
create index sync_runs_recent_idx on sync_runs(platform, started_at desc);

-- ---------------------------------------------------------------------
-- events — state changes for audit (e.g. "Quran moved from invited→member")
-- ---------------------------------------------------------------------
create table events (
  id          bigserial primary key,
  lead_id     uuid references leads(id) on delete cascade,
  platform    platform_t,
  event_type  text not null,          -- invited, joined, failed, resolved, archived, etc.
  from_status presence_status_t,
  to_status   presence_status_t,
  actor       text,                   -- 'sync', 'user:<email>', 'n8n:<workflow>'
  payload     jsonb,
  created_at  timestamptz default now()
);
create index events_lead_idx on events(lead_id, created_at desc);

-- ---------------------------------------------------------------------
-- vw_lead_full — the wide canonical view the dashboard reads.
-- One row per lead with boolean / status flags for each platform.
-- ---------------------------------------------------------------------
create or replace view vw_lead_full as
select
  l.id,
  l.email,
  l.full_name,
  l.program_tier,
  l.sales_rep,
  l.close_lead_id,
  l.airtable_id,
  l.mn_invite_id,
  l.mn_member_id,
  l.intercom_id,
  l.vendhub_user_id,
  l.vendhub_org,
  l.created_at,
  l.updated_at,
  -- Per-platform status (coalesced to 'unknown' when we haven't synced)
  coalesce((select status from platform_presence where lead_id = l.id and platform = 'close'), 'unknown')     as close_status,
  coalesce((select status from platform_presence where lead_id = l.id and platform = 'airtable'), 'unknown')  as airtable_status,
  coalesce((select status from platform_presence where lead_id = l.id and platform = 'mighty'), 'unknown')    as mighty_status,
  coalesce((select status from platform_presence where lead_id = l.id and platform = 'intercom'), 'unknown')  as intercom_status,
  coalesce((select status from platform_presence where lead_id = l.id and platform = 'vendhub'), 'unknown')   as vendhub_status,
  -- Boolean convenience flags
  exists(select 1 from platform_presence where lead_id = l.id and platform = 'close'    and status = 'member') as in_close,
  exists(select 1 from platform_presence where lead_id = l.id and platform = 'airtable' and status = 'member') as in_airtable,
  exists(select 1 from platform_presence where lead_id = l.id and platform = 'mighty'   and status in ('member','invited')) as in_mighty,
  exists(select 1 from platform_presence where lead_id = l.id and platform = 'intercom' and status in ('member','invited')) as in_intercom,
  exists(select 1 from platform_presence where lead_id = l.id and platform = 'vendhub'  and status = 'member') as in_vendhub
from leads l;

-- ---------------------------------------------------------------------
-- vw_platform_gaps — the answer to "which platforms is each lead missing
-- from?". Used by the /api/platforms/gaps endpoint.
-- ---------------------------------------------------------------------
create or replace view vw_platform_gaps as
select
  id,
  email,
  full_name,
  close_lead_id,
  -- Missing-from buckets
  not in_close    as missing_close,
  not in_airtable as missing_airtable,
  not in_mighty   as missing_mighty,
  not in_intercom as missing_intercom,
  not in_vendhub  as missing_vendhub,
  -- Classification
  case
    when in_close and in_airtable and in_mighty and in_intercom and in_vendhub then 'fully_onboarded'
    when in_close and not (in_airtable and in_mighty and in_intercom and in_vendhub) then 'close_only_or_partial'
    when in_airtable and not in_close then 'airtable_orphan'
    when in_intercom and not in_close then 'intercom_orphan'
    when in_mighty and not in_close then 'mighty_orphan'
    when in_vendhub and not in_close then 'vendhub_orphan'
    else 'unclassified'
  end as classification
from vw_lead_full;

-- ---------------------------------------------------------------------
-- Helpful functions for the syncers
-- ---------------------------------------------------------------------

-- Upsert a lead by email. Returns lead id.
create or replace function upsert_lead(
  p_email text,
  p_full_name text default null,
  p_program_tier text default null,
  p_sales_rep text default null,
  p_close_lead_id text default null,
  p_airtable_id text default null,
  p_mn_member_id text default null,
  p_mn_invite_id text default null,
  p_intercom_id text default null,
  p_vendhub_user_id text default null,
  p_vendhub_org text default null
) returns uuid
language plpgsql as $$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'email is required for upsert_lead';
  end if;
  insert into leads (email, full_name, program_tier, sales_rep, close_lead_id, airtable_id, mn_member_id, mn_invite_id, intercom_id, vendhub_user_id, vendhub_org)
  values (v_email, p_full_name, p_program_tier, p_sales_rep, p_close_lead_id, p_airtable_id, p_mn_member_id, p_mn_invite_id, p_intercom_id, p_vendhub_user_id, p_vendhub_org)
  on conflict (email) do update set
    full_name       = coalesce(excluded.full_name, leads.full_name),
    program_tier    = coalesce(excluded.program_tier, leads.program_tier),
    sales_rep       = coalesce(excluded.sales_rep, leads.sales_rep),
    close_lead_id   = coalesce(excluded.close_lead_id, leads.close_lead_id),
    airtable_id     = coalesce(excluded.airtable_id, leads.airtable_id),
    mn_member_id    = coalesce(excluded.mn_member_id, leads.mn_member_id),
    mn_invite_id    = coalesce(excluded.mn_invite_id, leads.mn_invite_id),
    intercom_id     = coalesce(excluded.intercom_id, leads.intercom_id),
    vendhub_user_id = coalesce(excluded.vendhub_user_id, leads.vendhub_user_id),
    vendhub_org     = coalesce(excluded.vendhub_org, leads.vendhub_org),
    last_seen_at    = now(),
    updated_at      = now()
  returning id into v_id;
  return v_id;
end $$;

-- Upsert a presence row. Logs a state-change event when status actually changes.
create or replace function upsert_presence(
  p_lead_id uuid,
  p_platform platform_t,
  p_status presence_status_t,
  p_external_id text default null,
  p_joined_at timestamptz default null,
  p_invited_at timestamptz default null,
  p_failed_at timestamptz default null,
  p_raw jsonb default null
) returns void
language plpgsql as $$
declare
  v_old presence_status_t;
begin
  select status into v_old from platform_presence where lead_id = p_lead_id and platform = p_platform;

  insert into platform_presence (lead_id, platform, status, external_id, joined_at, invited_at, failed_at, raw, last_checked_at)
  values (p_lead_id, p_platform, p_status, p_external_id, p_joined_at, p_invited_at, p_failed_at, p_raw, now())
  on conflict (lead_id, platform) do update set
    status          = excluded.status,
    external_id     = coalesce(excluded.external_id, platform_presence.external_id),
    joined_at       = coalesce(excluded.joined_at, platform_presence.joined_at),
    invited_at      = coalesce(excluded.invited_at, platform_presence.invited_at),
    failed_at       = coalesce(excluded.failed_at, platform_presence.failed_at),
    raw             = excluded.raw,
    last_checked_at = now();

  if v_old is distinct from p_status then
    insert into events (lead_id, platform, event_type, from_status, to_status, actor, payload)
    values (p_lead_id, p_platform, 'status_change', v_old, p_status, 'sync', p_raw);
  end if;
end $$;
