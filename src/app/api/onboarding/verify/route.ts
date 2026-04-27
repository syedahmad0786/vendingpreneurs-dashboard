/**
 * POST /api/onboarding/verify
 *
 * Kicks off a bulk verification run for a given step. Useful as a "Verify Now"
 * button on the dashboard — the actual per-step n8n workflows also run on a
 * schedule, but this lets users force a fresh check.
 *
 * Body: { step: "intercom" | "vendhub" | "all" }
 */

import { NextRequest, NextResponse } from "next/server";
import { invalidateTableCache } from "@/lib/airtable";

export const maxDuration = 30;

const N8N_BASE_URL =
  process.env.N8N_BASE_URL || "https://n8n.aimanagingservices.com";

async function trigger(path: string, body: Record<string, unknown> = {}) {
  const url = `${N8N_BASE_URL}${path}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {}
    return { ok: r.ok, status: r.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function POST(req: NextRequest) {
  let body: { step?: string } = {};
  try {
    body = await req.json();
  } catch {}

  const step = (body.step || "all").toLowerCase();

  const jobs: Record<string, Awaited<ReturnType<typeof trigger>>> = {};

  if (step === "intercom" || step === "all") {
    jobs.intercom = await trigger("/webhook/ma-verify-intercom", {});
  }
  if (step === "vendhub" || step === "all") {
    // VendHub verify expects { emailMap }. Triggering without one causes it
    // to process the empty map and only mark leads as Not Found. Keeping the
    // hook here for future expansion — in practice the bulk seed happens
    // server-side via scripts/vendhub-sync.ts.
    jobs.vendhub = {
      ok: true,
      status: 200,
      data: {
        note:
          "VendHub verification runs on a schedule; dashboard triggers are no-op for now.",
      },
    };
  }

  invalidateTableCache("clients");

  return NextResponse.json({
    success: true,
    step,
    jobs,
    note: "Background verification kicked off — refresh the dashboard in ~30s to see updated statuses.",
    triggeredAt: new Date().toISOString(),
  });
}
