/**
 * POST /api/actions
 *
 * Endpoint for triggering backend actions (n8n webhooks).
 *
 * Request body:
 * {
 *   action: "resubmit" | "audit",
 *   payload?: { ... }   // Required for "resubmit", ignored for "audit"
 * }
 *
 * Response:
 * { success: boolean, message: string, data?: unknown }
 */

import { NextRequest, NextResponse } from "next/server";
import { triggerResubmit, triggerAudit } from "@/lib/n8n";

interface ActionRequestBody {
  action: "resubmit" | "audit";
  payload?: Record<string, unknown>;
}

const VALID_ACTIONS = ["resubmit", "audit"] as const;

export async function POST(request: NextRequest) {
  try {
    let body: ActionRequestBody;

    try {
      body = (await request.json()) as ActionRequestBody;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate action
    if (!body.action || !VALID_ACTIONS.includes(body.action)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid action "${body.action}". Valid actions: ${VALID_ACTIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Dispatch to the appropriate n8n webhook
    switch (body.action) {
      case "resubmit": {
        if (!body.payload || Object.keys(body.payload).length === 0) {
          return NextResponse.json(
            {
              success: false,
              message: "Resubmit action requires a non-empty payload",
            },
            { status: 400 }
          );
        }
        const result = await triggerResubmit(body.payload);
        const status = result.success ? 200 : 502;
        return NextResponse.json(result, { status });
      }

      case "audit": {
        const result = await triggerAudit();
        const status = result.success ? 200 : 502;
        return NextResponse.json(result, { status });
      }

      default:
        return NextResponse.json(
          { success: false, message: "Unhandled action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[actions] Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, message: `Action failed: ${message}` },
      { status: 500 }
    );
  }
}
