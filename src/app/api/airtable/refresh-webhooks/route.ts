/**
 * GET / POST /api/airtable/refresh-webhooks
 *
 * Airtable change-notification webhooks expire after 7 days. This route
 * refreshes them so the dashboard stays in sync. Wired to a daily Vercel
 * cron in vercel.json.
 *
 * Lists every webhook on the base and re-creates any that's within 24h
 * of expiry. Idempotent and safe to call manually.
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

const NOTIFY_URL = "https://v0-vendingpreneurs-dashboard.vercel.app/api/onboarding/notify";
const TABLES_TO_WATCH: { id: string; name: string }[] = [
  { id: "tblaQ6fpHGhRs56sH", name: "Onboarding Errors" },
  { id: "tblwDucKYAsPDVBA2", name: "Clients" },
];

function authOk(req: NextRequest): boolean {
  if (!CRON_SECRET) return true;
  if (req.headers.get("x-cron-secret") === CRON_SECRET) return true;
  if (req.headers.get("x-vercel-cron")) return true;
  return false;
}

interface AirtableWebhook {
  id: string;
  notificationUrl: string;
  expirationTime: string;
  specification: {
    options?: {
      filters?: {
        recordChangeScope?: string;
      };
    };
  };
}

async function listWebhooks(): Promise<AirtableWebhook[]> {
  const res = await fetch(`https://api.airtable.com/v0/bases/${AIRTABLE_BASE}/webhooks`, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  const json = (await res.json()) as { webhooks: AirtableWebhook[] };
  return json.webhooks || [];
}

async function deleteWebhook(id: string): Promise<void> {
  await fetch(`https://api.airtable.com/v0/bases/${AIRTABLE_BASE}/webhooks/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
  });
}

async function createWebhook(tableId: string): Promise<{ id: string; expirationTime: string }> {
  const res = await fetch(`https://api.airtable.com/v0/bases/${AIRTABLE_BASE}/webhooks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      notificationUrl: NOTIFY_URL,
      specification: {
        options: {
          filters: { dataTypes: ["tableData"], recordChangeScope: tableId },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { id: string; expirationTime: string };
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h before expiry

  try {
    const existing = await listWebhooks();
    const ourWebhooks = existing.filter(
      (w) =>
        w.notificationUrl === NOTIFY_URL &&
        TABLES_TO_WATCH.some((t) => t.id === w.specification?.options?.filters?.recordChangeScope)
    );

    const actions: { table: string; action: string; webhookId?: string; expires?: string }[] = [];

    // For each watched table, ensure exactly one fresh webhook exists.
    for (const t of TABLES_TO_WATCH) {
      const existingForTable = ourWebhooks.filter(
        (w) => w.specification?.options?.filters?.recordChangeScope === t.id
      );

      const fresh = existingForTable.find((w) => {
        const ms = new Date(w.expirationTime).getTime() - Date.now();
        return ms > REFRESH_THRESHOLD_MS;
      });

      if (fresh && existingForTable.length === 1) {
        actions.push({
          table: t.name,
          action: "kept (still fresh)",
          webhookId: fresh.id,
          expires: fresh.expirationTime,
        });
        continue;
      }

      // Either no fresh webhook, or duplicates — clean up + recreate.
      for (const w of existingForTable) {
        await deleteWebhook(w.id);
        actions.push({ table: t.name, action: "deleted (stale or dup)", webhookId: w.id });
      }
      const created = await createWebhook(t.id);
      actions.push({
        table: t.name,
        action: "created",
        webhookId: created.id,
        expires: created.expirationTime,
      });
    }

    return NextResponse.json({
      ok: true,
      actions,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

export const GET = POST;
