/**
 * GET /api/airtable
 *
 * Proxy endpoint for Airtable API requests. Keeps the PAT server-side
 * so the frontend never exposes credentials.
 *
 * Query params:
 *   table        - Table name (e.g. "clients") or raw table ID  (required)
 *   fields       - Comma-separated field names                  (optional)
 *   filter       - Airtable filterByFormula string               (optional)
 *   maxRecords   - Maximum records to return                     (optional)
 *   sort         - "field:direction" e.g. "Name:asc"             (optional)
 *   view         - Airtable view name                            (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTable, resolveTableId } from "@/lib/airtable";

// Allow up to 60 seconds for large table fetches
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // -----------------------------------------------------------------
    // Required: table name or ID
    // -----------------------------------------------------------------
    const tableParam = searchParams.get("table");
    if (!tableParam) {
      return NextResponse.json(
        { error: "Missing required query parameter: table" },
        { status: 400 }
      );
    }

    // Validate that the table name/ID is resolvable
    try {
      resolveTableId(tableParam);
    } catch {
      return NextResponse.json(
        { error: `Invalid table: ${tableParam}` },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------
    // Optional parameters
    // -----------------------------------------------------------------
    const fieldsParam = searchParams.get("fields");
    const fields = fieldsParam
      ? fieldsParam.split(",").map((f) => f.trim())
      : undefined;

    const filterByFormula = searchParams.get("filter") || undefined;

    const maxRecordsParam = searchParams.get("maxRecords");
    const maxRecords = maxRecordsParam
      ? parseInt(maxRecordsParam, 10)
      : undefined;

    // sort is passed as "field:direction" e.g. "Name:asc"
    const sortParam = searchParams.get("sort");
    let sort: { field: string; direction?: "asc" | "desc" }[] | undefined;
    if (sortParam) {
      const [field, direction] = sortParam.split(":");
      sort = [
        {
          field,
          direction: (direction as "asc" | "desc") || "asc",
        },
      ];
    }

    const view = searchParams.get("view") || undefined;

    // -----------------------------------------------------------------
    // Fetch from Airtable (uses caching internally)
    // -----------------------------------------------------------------
    const records = await fetchTable(tableParam, {
      fields,
      filterByFormula,
      maxRecords,
      sort,
      view,
    });

    return NextResponse.json({
      records,
      count: records.length,
    });
  } catch (error) {
    console.error("[airtable proxy] Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Failed to fetch Airtable data", detail: message },
      { status: 500 }
    );
  }
}
