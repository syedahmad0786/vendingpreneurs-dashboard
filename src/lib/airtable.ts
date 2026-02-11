/**
 * Airtable API client with caching, auto-pagination, and rate-limit handling.
 * All table fetches are cached for 5 minutes via the in-memory cache.
 */

import { cache, DEFAULT_TTL_MS } from "./cache";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_API_URL = "https://api.airtable.com/v0";

// Maximum retries on 429 (rate limited) responses
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Table ID map  (human-readable name -> Airtable table ID)
// ---------------------------------------------------------------------------

export const TABLE_IDS = {
  clients: "tblwDucKYAsPDVBA2",
  studentOnboarding: "tblMLFYTeoqrtmgXQ",
  onboardingErrors: "tblaQ6fpHGhRs56sH",
  warmLeads: "tblEGcRkLq1Q60YdU",
  nationalContractsMSA: "tblnqXCY8j8VACuAw",
  completeNationalContracts: "tblmeZJJDVncqwuNd",
  kpiSnapshots: "tblcYWXa4lmi5jgxv",
  refunds: "tbl3U2XsirQZHBZHy",
  clientLevelLog: "tblgebc4dRdTLVJO9",
  warmLeadQA: "tblJnWURjV8H4gwNo",
  dataQuality: "tblJilmE7etZB076t",
  missedLeads: "tblve21i7jwywbfCC",
} as const;

export type TableName = keyof typeof TABLE_IDS;

/**
 * Resolve a table identifier that may be either a human-readable name
 * (e.g. "clients") or a raw Airtable table ID (e.g. "tblwDucK...").
 */
export function resolveTableId(tableNameOrId: string): string {
  if (tableNameOrId.startsWith("tbl")) return tableNameOrId;
  const id = TABLE_IDS[tableNameOrId as TableName];
  if (!id) {
    throw new Error(
      `Unknown table name "${tableNameOrId}". Valid names: ${Object.keys(TABLE_IDS).join(", ")}`
    );
  }
  return id;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

export interface FetchTableOptions {
  fields?: string[];
  filterByFormula?: string;
  maxRecords?: number;
  sort?: { field: string; direction?: "asc" | "desc" }[];
  view?: string;
  /** Override default cache TTL (ms). Set to 0 to bypass cache. */
  cacheTtl?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a cache key from a table ID and the fetch options.
 */
function buildCacheKey(tableId: string, options?: FetchTableOptions): string {
  const parts = [`airtable:${tableId}`];
  if (options?.fields) parts.push(`f:${options.fields.join(",")}`);
  if (options?.filterByFormula) parts.push(`q:${options.filterByFormula}`);
  if (options?.maxRecords) parts.push(`m:${options.maxRecords}`);
  if (options?.sort) parts.push(`s:${JSON.stringify(options.sort)}`);
  if (options?.view) parts.push(`v:${options.view}`);
  return parts.join("|");
}

/**
 * Sleep helper for retry back-off.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make a single GET request to the Airtable API with retry-on-429 logic.
 */
async function airtableGet(url: string): Promise<AirtableListResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
      },
    });

    // Rate limited -- back off and retry
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const delayMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
      await sleep(delayMs);
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      lastError = new Error(
        `Airtable API error ${response.status}: ${body}`
      );
      // For server errors, retry; for client errors, bail immediately
      if (response.status >= 500) {
        await sleep(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw lastError;
    }

    return (await response.json()) as AirtableListResponse;
  }

  throw lastError ?? new Error("Airtable request failed after max retries");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch records from an Airtable table with automatic pagination.
 * Results are cached for 5 minutes by default.
 *
 * @param tableNameOrId - Human-readable name (e.g. "clients") or raw table ID
 * @param options - Optional fields, filter, maxRecords, sort, view, cacheTtl
 * @returns Array of Airtable records
 */
export async function fetchTable(
  tableNameOrId: string,
  options?: FetchTableOptions
): Promise<AirtableRecord[]> {
  const tableId = resolveTableId(tableNameOrId);
  const ttl = options?.cacheTtl ?? DEFAULT_TTL_MS;
  const cacheKey = buildCacheKey(tableId, options);

  // Check cache first (unless ttl is 0)
  if (ttl > 0) {
    const cached = cache.get<AirtableRecord[]>(cacheKey);
    if (cached) return cached;
  }

  // Build the base URL
  const baseUrl = `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/${tableId}`;
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    // Build query parameters for this page
    const params = new URLSearchParams();

    if (options?.fields) {
      for (const field of options.fields) {
        params.append("fields[]", field);
      }
    }
    if (options?.filterByFormula) {
      params.set("filterByFormula", options.filterByFormula);
    }
    if (options?.maxRecords) {
      params.set("maxRecords", String(options.maxRecords));
    }
    if (options?.sort) {
      options.sort.forEach((s, i) => {
        params.set(`sort[${i}][field]`, s.field);
        if (s.direction) {
          params.set(`sort[${i}][direction]`, s.direction);
        }
      });
    }
    if (options?.view) {
      params.set("view", options.view);
    }
    if (offset) {
      params.set("offset", offset);
    }

    const url = `${baseUrl}?${params.toString()}`;
    const data = await airtableGet(url);

    allRecords.push(...data.records);
    offset = data.offset;

    // If maxRecords was specified and we have collected enough, stop
    if (options?.maxRecords && allRecords.length >= options.maxRecords) {
      break;
    }
  } while (offset);

  // Trim to maxRecords if we over-fetched on the last page
  const result =
    options?.maxRecords && allRecords.length > options.maxRecords
      ? allRecords.slice(0, options.maxRecords)
      : allRecords;

  // Cache the result
  if (ttl > 0) {
    cache.set(cacheKey, result, ttl);
  }

  return result;
}

/**
 * Convenience wrapper: fetch all records from a table, optionally
 * selecting specific fields and applying a filter formula.
 */
export async function fetchAllRecords(
  tableNameOrId: string,
  fields?: string[],
  filterByFormula?: string
): Promise<AirtableRecord[]> {
  return fetchTable(tableNameOrId, { fields, filterByFormula });
}

/**
 * Invalidate the cache for a specific table (all option combinations).
 * Useful after a write operation that changes the data.
 */
export function invalidateTableCache(tableNameOrId: string): void {
  const tableId = resolveTableId(tableNameOrId);
  // Since we cannot enumerate keys matching a prefix in Map efficiently,
  // we clear the entire cache. This is acceptable because the cache is
  // only used for short-lived dashboard queries.
  cache.clear();
  // Log for observability in development
  if (process.env.NODE_ENV === "development") {
    console.log(`[airtable] Cache cleared after invalidation for ${tableId}`);
  }
}
