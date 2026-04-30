/**
 * POST /api/verify/sweep
 *
 * Run all three platform verifiers (MN, Intercom, Close) in parallel
 * for either:
 *   - A single email passed in the body  → fast, catches a brand-new
 *     lead within seconds of being added.
 *   - The latest N rows added to the Clients table   → daily-cron mode,
 *     catches anything the per-lead trigger missed.
 *
 * Body:
 *   { email?: string }                     → single lead
 *   { newestN?: number }  (default 50)     → sweep mode, last N rows
 *
 * Why: Vercel Hobby plan limits crons to daily. The dedicated daily
 * verifiers (04:00, 04:30, 05:00 UTC) ensure full coverage, but new
 * leads added between cron runs are stuck "Awaiting verification" for
 * up to 24h. This sweep endpoint runs all three verifiers concurrently
 * so any newly-added active client can be caught up in a single ~10s
 * call. Wired to: the Airtable change webhook (per-lead) and a daily
 * sweep cron (defensive backstop).
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

function authOk(req: NextRequest): boolean {
  if (!CRON_SECRET) return true;
  if (req.headers.get("x-cron-secret") === CRON_SECRET) return true;
  if (req.headers.get("x-vercel-cron")) return true;
  return false;
}

interface VerifierResult {
  platform: string;
  ok: boolean;
  status: number;
  body?: unknown;
}

async function callVerifier(
  origin: string,
  path: string,
  payload: Record<string, unknown>
): Promise<VerifierResult> {
  const platform = path.split("/").pop() || path;
  try {
    const res = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cron-secret": CRON_SECRET,
      },
      body: JSON.stringify(payload),
    });
    let body: unknown = undefined;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    return { platform, ok: res.ok, status: res.status, body };
  } catch (err) {
    return {
      platform,
      ok: false,
      status: 0,
      body: { error: err instanceof Error ? err.message : "unknown" },
    };
  }
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { email?: string; newestN?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK — defaults to newestN=50 */
  }

  const origin = req.nextUrl.origin;
  const started = Date.now();
  const email = body.email?.trim().toLowerCase();
  const newestN = body.newestN ?? 50;

  // Per-email fast path: hits all three verifiers in parallel for one
  // email. Each verifier supports `email` in its payload to scope the run.
  if (email) {
    const results = await Promise.all([
      callVerifier(origin, "/api/verify/mighty-networks", { email }),
      callVerifier(origin, "/api/verify/intercom", { email }),
      callVerifier(origin, "/api/verify/close", { email }),
    ]);
    return NextResponse.json({
      ok: results.every((r) => r.ok),
      mode: "single-email",
      email,
      results,
      durationMs: Date.now() - started,
    });
  }

  // Sweep mode: each verifier already skips rows with populated state
  // (force=false), so this is cheap — only newly-added leads + anything
  // the daily cron missed get checked. We bound `max` so the function
  // always returns within the 60s envelope.
  const results = await Promise.all([
    callVerifier(origin, "/api/verify/mighty-networks", { max: newestN }),
    callVerifier(origin, "/api/verify/intercom", { max: newestN }),
    callVerifier(origin, "/api/verify/close", { max: newestN }),
  ]);
  return NextResponse.json({
    ok: results.every((r) => r.ok),
    mode: "sweep",
    newestN,
    results,
    durationMs: Date.now() - started,
  });
}

export const GET = POST;
