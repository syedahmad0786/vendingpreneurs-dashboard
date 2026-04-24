/**
 * n8n webhook client for triggering automations.
 * Supports resubmit-onboarding, per-step resubmits, and CRM audit workflows.
 */

const N8N_BASE_URL =
  process.env.N8N_BASE_URL || "https://n8n.aimanagingservices.com";
const N8N_API_KEY = process.env.N8N_API_KEY || "";
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || "";

export interface N8nResponse {
  success: boolean;
  message: string;
  data?: unknown;
  /** HTTP status when we got a response from n8n. */
  status?: number;
  /** Raw response body for the drawer to display when a retry still fails. */
  raw?: string;
}

export interface ResubmitPayload {
  [key: string]: unknown;
}

/**
 * Map an internal step id to the n8n webhook path.
 * These match the workflows defined in scripts/n8n/resubmit-*.json.
 */
const STEP_WEBHOOK_PATHS: Record<string, string> = {
  close_crm: "/webhook/ma-resubmit-close",
  email_validation: "/webhook/ma-resubmit-email",
  mighty_networks: "/webhook/ma-resubmit-mn",
  intercom: "/webhook/ma-resubmit-intercom",
  vendhub: "/webhook/ma-resubmit-vendhub",
};

/**
 * Generic helper to POST to an n8n webhook endpoint.
 */
async function postWebhook(
  path: string,
  payload?: Record<string, unknown>
): Promise<N8nResponse> {
  const url = `${N8N_BASE_URL}${path}`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Bearer API key — used if the n8n instance is protected globally.
    if (N8N_API_KEY) {
      headers["Authorization"] = `Bearer ${N8N_API_KEY}`;
    }

    // Per-webhook shared secret — included when configured so the
    // n8n workflow can verify requests it receives.
    if (N8N_WEBHOOK_SECRET) {
      headers["X-Webhook-Secret"] = N8N_WEBHOOK_SECRET;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload ?? {}),
    });

    const contentType = response.headers.get("content-type") || "";
    let data: unknown;
    let rawText = "";
    if (contentType.includes("application/json")) {
      try {
        data = await response.clone().json();
      } catch {
        data = null;
      }
      rawText = await response.text().catch(() => "");
    } else {
      rawText = await response.text().catch(() => "");
      data = rawText;
    }

    if (!response.ok) {
      return {
        success: false,
        message: `n8n webhook ${path} failed — HTTP ${response.status}`,
        status: response.status,
        raw: rawText.slice(0, 2000),
        data,
      };
    }

    // Some n8n workflows return {success:false, ...} with HTTP 200
    if (data && typeof data === "object" && (data as { success?: boolean }).success === false) {
      const d = data as { message?: string };
      return {
        success: false,
        message: d.message || "Retry completed but step reported failure",
        status: response.status,
        raw: rawText.slice(0, 2000),
        data,
      };
    }

    return {
      success: true,
      message: "Resubmit triggered successfully",
      status: response.status,
      data,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      message: `Failed to reach n8n webhook: ${errorMessage}`,
    };
  }
}

/**
 * Trigger the legacy generic resubmit workflow.
 */
export async function triggerResubmit(
  payload: ResubmitPayload
): Promise<N8nResponse> {
  return postWebhook("/webhook/resubmit-onboarding", payload);
}

/**
 * Trigger a specific per-step resubmit workflow (new granular behavior).
 */
export async function triggerStepResubmit(
  step: string,
  payload: ResubmitPayload
): Promise<N8nResponse> {
  const path = STEP_WEBHOOK_PATHS[step];
  if (!path) {
    return {
      success: false,
      message: `No webhook path configured for step "${step}"`,
    };
  }
  return postWebhook(path, payload);
}

/**
 * Trigger the CRM audit workflow.
 */
export async function triggerAudit(): Promise<N8nResponse> {
  return postWebhook("/webhook/crm-audit-trigger-55b555d3");
}
