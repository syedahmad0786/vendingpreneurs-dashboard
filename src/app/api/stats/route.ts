/**
 * GET /api/stats
 *
 * Returns ALL dashboard KPIs in one call. Fetches from multiple Airtable
 * tables, aggregates the data, and caches the result for 5 minutes.
 *
 * Response shape:
 * {
 *   overview:   { ... },
 *   onboarding: { ... },
 *   clients:    { ... },
 *   leads:      { ... },
 *   national:   { ... },
 *   revenue:    { ... },
 *   quality:    { ... },
 *   _meta:      { fetchedAt, cachedUntil, recordCounts }
 * }
 */

import { NextResponse } from "next/server";
import { fetchTable, TABLE_IDS } from "@/lib/airtable";
import { cache } from "@/lib/cache";
import {
  countByField,
  sumField,
  avgField,
  filterRecords,
  pct,
  currentMonthRecords,
  recentRecords,
  groupByMonth,
  formatCurrency,
} from "@/lib/utils";
import type { AirtableRecord } from "@/lib/utils";

const STATS_CACHE_KEY = "dashboard:stats:all";
const STATS_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Safely fetch a table -- returns [] on error so one failure
 *  does not break the entire stats endpoint. */
async function safeFetch(
  tableId: string,
  label: string
): Promise<AirtableRecord[]> {
  try {
    return await fetchTable(tableId);
  } catch (err) {
    console.error(`[stats] Failed to fetch ${label}:`, err);
    return [];
  }
}

/** Build { month: count } from a grouped-by-month map. */
function monthCounts(
  grouped: Record<string, AirtableRecord[]>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(grouped).map(([m, recs]) => [m, recs.length])
  );
}

// -----------------------------------------------------------------------
// GET handler
// -----------------------------------------------------------------------
export async function GET() {
  try {
    // Return cached stats if available
    const cached = cache.get<Record<string, unknown>>(STATS_CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch all 12 tables in parallel
    const [
      clients,
      studentOnboarding,
      onboardingErrors,
      warmLeads,
      nationalContractsMSA,
      completeNational,
      kpiSnapshots,
      refunds,
      clientLevelLog,
      warmLeadQA,
      dataQuality,
      missedLeads,
    ] = await Promise.all([
      safeFetch(TABLE_IDS.clients, "Clients"),
      safeFetch(TABLE_IDS.studentOnboarding, "Student Onboarding"),
      safeFetch(TABLE_IDS.onboardingErrors, "Onboarding Errors"),
      safeFetch(TABLE_IDS.warmLeads, "Warm Leads"),
      safeFetch(TABLE_IDS.nationalContractsMSA, "National Contracts MSA"),
      safeFetch(TABLE_IDS.completeNationalContracts, "Complete National"),
      safeFetch(TABLE_IDS.kpiSnapshots, "KPI Snapshots"),
      safeFetch(TABLE_IDS.refunds, "Refunds"),
      safeFetch(TABLE_IDS.clientLevelLog, "Client Level Log"),
      safeFetch(TABLE_IDS.warmLeadQA, "Warm Lead QA"),
      safeFetch(TABLE_IDS.dataQuality, "Data Quality"),
      safeFetch(TABLE_IDS.missedLeads, "Missed Leads"),
    ]);

    // =================================================================
    // OVERVIEW
    // =================================================================
    const clientStatusCounts = countByField(clients, "Status");
    const activeClients = clientStatusCounts["Active"] || 0;
    const totalRefundAmt = sumField(refunds, "Amount");

    const overview = {
      totalClients: clients.length,
      activeClients,
      inactiveClients: clients.length - activeClients,
      clientStatusBreakdown: clientStatusCounts,
      totalOnboarding: studentOnboarding.length,
      totalLeads: warmLeads.length,
      totalNationalContracts: nationalContractsMSA.length,
      totalRefunds: refunds.length,
      refundAmount: formatCurrency(totalRefundAmt),
      onboardingErrors: onboardingErrors.length,
      dataQualityIssues: dataQuality.length,
      missedLeads: missedLeads.length,
    };

    // =================================================================
    // ONBOARDING
    // =================================================================
    const obStatusCounts = countByField(studentOnboarding, "Status");
    const obByMonth = groupByMonth(studentOnboarding, "Created");
    const obErrorTypes = countByField(onboardingErrors, "Error Type");
    const recentOB = recentRecords(studentOnboarding, "Created", 30);

    const onboarding = {
      total: studentOnboarding.length,
      statusBreakdown: obStatusCounts,
      byMonth: monthCounts(obByMonth),
      recentCount: recentOB.length,
      errorCount: onboardingErrors.length,
      errorTypes: obErrorTypes,
      errorRate: pct(onboardingErrors.length, studentOnboarding.length),
    };

    // =================================================================
    // CLIENTS
    // =================================================================
    const clientsByMonth = groupByMonth(clients, "Created");
    const levelCounts = countByField(clientLevelLog, "Level");
    const thisMonthClients = currentMonthRecords(clients, "Created");

    const clientsSection = {
      total: clients.length,
      active: activeClients,
      inactive: clients.length - activeClients,
      activeRate: pct(activeClients, clients.length),
      statusBreakdown: clientStatusCounts,
      byMonth: monthCounts(clientsByMonth),
      levelBreakdown: levelCounts,
      newThisMonth: thisMonthClients.length,
    };

    // =================================================================
    // LEADS
    // =================================================================
    const leadStatusCounts = countByField(warmLeads, "Status");
    const leadSourceCounts = countByField(warmLeads, "Source");
    const leadsByMonth = groupByMonth(warmLeads, "Created");
    const qaPassCount = filterRecords(warmLeadQA, "QA Result", "Pass").length;
    const qaTotal = warmLeadQA.length;

    const leads = {
      total: warmLeads.length,
      statusBreakdown: leadStatusCounts,
      sourceBreakdown: leadSourceCounts,
      byMonth: monthCounts(leadsByMonth),
      missed: missedLeads.length,
      qaTotal,
      qaPassCount,
      qaPassRate: pct(qaPassCount, qaTotal),
    };

    // =================================================================
    // NATIONAL CONTRACTS
    // =================================================================
    const msaStatusCounts = countByField(nationalContractsMSA, "Status");
    const contractsByMonth = groupByMonth(nationalContractsMSA, "Created");

    const national = {
      totalMSA: nationalContractsMSA.length,
      msaStatusBreakdown: msaStatusCounts,
      completeContracts: completeNational.length,
      byMonth: monthCounts(contractsByMonth),
      completionRate: pct(completeNational.length, nationalContractsMSA.length),
    };

    // =================================================================
    // REVENUE (refunds perspective)
    // =================================================================
    const avgRefund = avgField(refunds, "Amount");
    const refundsByMonth = groupByMonth(refunds, "Created");
    const refundReasons = countByField(refunds, "Reason");

    const revenue = {
      totalRefunds: refunds.length,
      totalRefundAmount: formatCurrency(totalRefundAmt),
      totalRefundAmountRaw: totalRefundAmt,
      avgRefund: formatCurrency(avgRefund),
      avgRefundRaw: Math.round(avgRefund * 100) / 100,
      refundsByMonth: Object.fromEntries(
        Object.entries(refundsByMonth).map(([m, recs]) => [
          m,
          { count: recs.length, amount: sumField(recs, "Amount") },
        ])
      ),
      refundReasons,
    };

    // =================================================================
    // QUALITY
    // =================================================================
    const dqTypeCounts = countByField(dataQuality, "Issue Type");
    const dqStatusCounts = countByField(dataQuality, "Status");
    const recentDQ = recentRecords(dataQuality, "Created", 7);

    const quality = {
      dataQualityIssues: dataQuality.length,
      issueTypes: dqTypeCounts,
      issueStatusBreakdown: dqStatusCounts,
      recentIssues: recentDQ.length,
      missedLeads: missedLeads.length,
      missedLeadsByMonth: monthCounts(
        groupByMonth(missedLeads, "Created")
      ),
      onboardingErrorRate: pct(
        onboardingErrors.length, studentOnboarding.length
      ),
      qaPassRate: pct(qaPassCount, qaTotal),
    };

    // =================================================================
    // Assemble final response
    // =================================================================
    const now = new Date();
    const stats = {
      overview,
      onboarding,
      clients: clientsSection,
      leads,
      national,
      revenue,
      quality,
      _meta: {
        fetchedAt: now.toISOString(),
        cachedUntil: new Date(now.getTime() + STATS_TTL_MS).toISOString(),
        recordCounts: {
          clients: clients.length,
          studentOnboarding: studentOnboarding.length,
          onboardingErrors: onboardingErrors.length,
          warmLeads: warmLeads.length,
          nationalContractsMSA: nationalContractsMSA.length,
          completeNationalContracts: completeNational.length,
          kpiSnapshots: kpiSnapshots.length,
          refunds: refunds.length,
          clientLevelLog: clientLevelLog.length,
          warmLeadQA: warmLeadQA.length,
          dataQuality: dataQuality.length,
          missedLeads: missedLeads.length,
        },
      },
    };

    // Cache the assembled stats
    cache.set(STATS_CACHE_KEY, stats, STATS_TTL_MS);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[stats] Failed to build dashboard stats:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats", detail: message },
      { status: 500 }
    );
  }
}
