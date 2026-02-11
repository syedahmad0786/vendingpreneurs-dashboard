/**
 * Data aggregation and formatting utilities for dashboard KPI computation.
 * All functions operate on Airtable record arrays: { id, fields: { ... } }.
 */

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

/**
 * Count occurrences of each unique value in a specific field.
 * Useful for grouping by status, type, source, etc.
 *
 * @example countByField(records, "Status")
 * // => { "Active": 42, "Inactive": 8, "Pending": 3 }
 */
export function countByField(
  records: AirtableRecord[],
  fieldName: string
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const record of records) {
    const value = record.fields[fieldName];
    // Handle arrays (e.g., linked records, multi-select)
    if (Array.isArray(value)) {
      for (const v of value) {
        const key = String(v);
        counts[key] = (counts[key] || 0) + 1;
      }
    } else if (value !== undefined && value !== null && value !== "") {
      const key = String(value);
      counts[key] = (counts[key] || 0) + 1;
    } else {
      counts["(empty)"] = (counts["(empty)"] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Sum all numeric values in a specific field across records.
 * Non-numeric values are skipped.
 */
export function sumField(
  records: AirtableRecord[],
  fieldName: string
): number {
  let total = 0;
  for (const record of records) {
    const value = record.fields[fieldName];
    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (!isNaN(num)) {
      total += num;
    }
  }
  return total;
}

/**
 * Calculate the average of numeric values in a specific field.
 * Non-numeric values are excluded from both the sum and count.
 * Returns 0 if no valid numeric values exist.
 */
export function avgField(
  records: AirtableRecord[],
  fieldName: string
): number {
  let total = 0;
  let count = 0;
  for (const record of records) {
    const value = record.fields[fieldName];
    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (!isNaN(num)) {
      total += num;
      count++;
    }
  }
  return count === 0 ? 0 : total / count;
}

/**
 * Filter records where a field matches a specific value.
 * Supports exact match for strings/numbers and inclusion check for arrays.
 */
export function filterRecords(
  records: AirtableRecord[],
  fieldName: string,
  value: unknown
): AirtableRecord[] {
  return records.filter((record) => {
    const fieldValue = record.fields[fieldName];
    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(value);
    }
    return fieldValue === value;
  });
}

/**
 * Group records by month based on a date field.
 * Returns a map of "YYYY-MM" keys to arrays of records.
 * Records with invalid or missing dates are placed under "(no date)".
 */
export function groupByMonth(
  records: AirtableRecord[],
  dateField: string
): Record<string, AirtableRecord[]> {
  const groups: Record<string, AirtableRecord[]> = {};

  for (const record of records) {
    const dateValue = record.fields[dateField];
    let key = "(no date)";

    if (dateValue && typeof dateValue === "string") {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        key = `${year}-${month}`;
      }
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record);
  }

  return groups;
}

/**
 * Format a number as USD currency string.
 * @example formatCurrency(1234.5)  => "$1,235"
 * @example formatCurrency(1234567) => "$1,234,567"
 */
export function formatCurrency(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return "$0";
  return "$" + Math.round(num).toLocaleString("en-US");
}

/**
 * Format a number with compact notation.
 * @example formatNumber(1234)    => "1.2K"
 * @example formatNumber(1234567) => "1.2M"
 * @example formatNumber(500)     => "500"
 */
export function formatNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return "0";

  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (absNum >= 1_000_000_000) {
    return sign + (absNum / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  }
  if (absNum >= 1_000_000) {
    return sign + (absNum / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (absNum >= 1_000) {
    return sign + (absNum / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }

  return sign + String(Math.round(absNum));
}

/**
 * Calculate percentage: (part / total) * 100, rounded to 1 decimal.
 * Returns 0 if total is 0.
 */
export function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Get records from the current month based on a date field.
 */
export function currentMonthRecords(
  records: AirtableRecord[],
  dateField: string
): AirtableRecord[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return records.filter((record) => {
    const dateValue = record.fields[dateField];
    if (!dateValue || typeof dateValue !== "string") return false;
    const parsed = new Date(dateValue);
    return parsed.getFullYear() === year && parsed.getMonth() === month;
  });
}

/**
 * Get records from the last N days based on a date field.
 */
export function recentRecords(
  records: AirtableRecord[],
  dateField: string,
  days: number
): AirtableRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return records.filter((record) => {
    const dateValue = record.fields[dateField];
    if (!dateValue || typeof dateValue !== "string") return false;
    const parsed = new Date(dateValue);
    return parsed >= cutoff;
  });
}
