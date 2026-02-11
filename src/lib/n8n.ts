/**
 * n8n webhook client for triggering automations.
 * Supports resubmit-onboarding and CRM audit workflows.
 */

const N8N_BASE_URL =
  process.env.N8N_BASE_URL || "https://n8n.aimanagingservices.com";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

export interface N8nResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface ResubmitPayload {
  [key: string]: unknown;
}

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

    // Include API key if available
    if (N8N_API_KEY) {
      headers["Authorization"] = `Bearer ${N8N_API_KEY}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload ?? {}),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        message: `n8n webhook failed with status ${response.status}: ${errorText}`,
      };
    }

    // Some n8n webhooks return JSON, some return plain text
    const contentType = response.headers.get("content-type") || "";
    let data: unknown;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      success: true,
      message: "Webhook triggered successfully",
      data,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      message: `Failed to trigger n8n webhook: ${errorMessage}`,
    };
  }
}

/**
 * Trigger the resubmit-onboarding workflow.
 * Sends the provided payload to the n8n webhook for re-processing
 * a student onboarding submission.
 */
export async function triggerResubmit(
  payload: ResubmitPayload
): Promise<N8nResponse> {
  return postWebhook("/webhook/resubmit-onboarding", payload);
}

/**
 * Trigger the CRM audit workflow.
 * Kicks off a full audit of the CRM data quality.
 */
export async function triggerAudit(): Promise<N8nResponse> {
  return postWebhook("/webhook/crm-audit-trigger-55b555d3");
}
