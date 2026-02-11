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

// Allow up to 60 seconds for this endpoint (fetches 12 tables)
export const maxDuration = 60;

const STATS_CACHE_KEY = "dashboard:stats:all";
const STATS_TTL_MS = 2 * 60 * 1000; // 2 minutes

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
export async function GET(request: Request) {
  try {
    // Check for refresh bypass
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    // Return cached stats if available (unless force refresh)
    if (!forceRefresh) {
      const cached = cache.get<Record<string, unknown>>(STATS_CACHE_KEY);
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
          },
        });
      }
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
    // Try multiple possible field names for client status
    const clientStatusCounts = {
      ...countByField(clients, "Status"),
      ...countByField(clients, "Program Stages"),
    };
    // Count active clients by checking multiple possible status values
    const activeClients = clients.filter((r) => {
      const status = String(r.fields["Status"] ?? "");
      return (
        status &&
        status !== "Churned" &&
        status !== "Full Refund" &&
        status !== "Cancelled" &&
        status !== "Paused" &&
        status !== ""
      );
    }).length;

    const totalRefundAmt = sumField(refunds, "Refund Amount") || sumField(refunds, "Amount");

    const programStageCounts = countByField(clients, "Program Stages");
    const membershipLevelCounts = countByField(clients, "Membership Level");
    const currentPhaseCounts = countByField(clients, "Current Phase");

    const totalMachines = sumField(clients, "Total Number of Machines");
    const totalRevenue = sumField(clients, "Total Monthly Revenue");
    const totalNetRevenue = sumField(clients, "Total Net Revenue");

    const overview = {
      totalClients: clients.length,
      activeClients,
      inactiveClients: clients.length - activeClients,
      clientStatusBreakdown: countByField(clients, "Status"),
      programStageBreakdown: programStageCounts,
      membershipLevelBreakdown: membershipLevelCounts,
      currentPhaseBreakdown: currentPhaseCounts,
      totalMachines,
      totalRevenue: formatCurrency(totalRevenue),
      totalRevenueRaw: totalRevenue,
      totalNetRevenue: formatCurrency(totalNetRevenue),
      totalNetRevenueRaw: totalNetRevenue,
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
    const obByMonth = groupByMonth(studentOnboarding, "Create Date") ||
                      groupByMonth(studentOnboarding, "Created");
    const obErrorTypes = countByField(onboardingErrors, "Error Type");
    const obErrorStatus = countByField(onboardingErrors, "Status");
    const activeErrors = (obErrorStatus["New"] ?? 0) + (obErrorStatus["Investigating"] ?? 0);
    const recentOB = recentRecords(studentOnboarding, "Create Date", 30) ||
                     recentRecords(studentOnboarding, "Created", 30);

    // Onboarding phases from clients in stage 1
    const onboardingClients = clients.filter((r) =>
      String(r.fields["Program Stages"] ?? "").includes("Onboarding")
    );
    const onboardingByPhase = countByField(onboardingClients, "Current Phase");

    // Pending student records (Skool not granted)
    const pendingSkool = studentOnboarding.filter(
      (r) => !r.fields["Skool Granted"] && !r.fields["Skool granted"]
    ).length;

    // Compute avg days to complete onboarding from client level log
    const obLevelRecords = clientLevelLog.filter((r) =>
      String(r.fields["Program Level"] ?? r.fields["Level"] ?? "")
        .toLowerCase()
        .includes("onboarding")
    );
    const avgDaysToComplete =
      obLevelRecords.length > 0
        ? Math.round(
            avgField(obLevelRecords, "Days Spent in this Level") ||
            avgField(obLevelRecords, "Days in Level") ||
            avgField(obLevelRecords, "Days") ||
            0
          )
        : 0;

    // Completion trend: monthly count of completed onboardings
    const completionTrend = Object.entries(monthCounts(obByMonth))
      .sort()
      .slice(-6)
      .map(([month, completed]) => ({
        month: month.slice(5), // "2024-09" → "09"
        completed,
      }));

    const onboarding = {
      total: studentOnboarding.length,
      statusBreakdown: obStatusCounts,
      byMonth: monthCounts(obByMonth),
      recentCount: recentOB.length,
      errorCount: onboardingErrors.length,
      activeErrors,
      errorTypes: obErrorTypes,
      errorStatusBreakdown: obErrorStatus,
      errorRate: pct(onboardingErrors.length, studentOnboarding.length),
      onboardingByPhase,
      onboardingClientCount: onboardingClients.length,
      pendingSkool,
      // Aliases for onboarding page consumption
      inOnboarding: onboardingClients.length,
      pendingStudentRecords: pendingSkool,
      avgDaysToComplete,
      phaseBreakdown: onboardingByPhase,
      completionTrend,
    };

    // =================================================================
    // CLIENTS
    // =================================================================
    const clientsByMonth = groupByMonth(clients, "Date Added") ||
                          groupByMonth(clients, "Created");
    const levelCounts = countByField(clientLevelLog, "Program Level") ||
                       countByField(clientLevelLog, "Level");
    const thisMonthClients = currentMonthRecords(clients, "Date Added") ||
                            currentMonthRecords(clients, "Created");

    const avgDaysInProgram = avgField(clients, "Days in Program");
    const churnedCount = clients.filter((r) =>
      String(r.fields["Status"] ?? "").toLowerCase().includes("churn")
    ).length;
    const dialPriorityCounts = countByField(clients, "Dial Priority");

    const clientsSection = {
      total: clients.length,
      active: activeClients,
      inactive: clients.length - activeClients,
      activeRate: pct(activeClients, clients.length),
      statusBreakdown: countByField(clients, "Status"),
      programStageBreakdown: programStageCounts,
      membershipBreakdown: membershipLevelCounts,
      byMonth: monthCounts(clientsByMonth),
      levelBreakdown: levelCounts,
      newThisMonth: thisMonthClients.length,
      avgDaysInProgram: Math.round(avgDaysInProgram),
      churnRate: pct(churnedCount, clients.length),
      churnedCount,
      dialPriority: dialPriorityCounts,
      totalMachines,
    };

    // =================================================================
    // LEADS
    // =================================================================
    const leadTempCounts = countByField(warmLeads, "Lead Temperature");
    const leadStatusCounts = countByField(warmLeads, "Status");
    const leadOutcomeCounts = countByField(warmLeads, "Final Outcome");
    const leadSourceCounts = countByField(warmLeads, "Lead Source") ||
                            countByField(warmLeads, "Source");
    const leadTypeCounts = countByField(warmLeads, "Lead Type");
    const leadLocationCounts = countByField(warmLeads, "Location Type");
    const leadsByMonth = groupByMonth(warmLeads, "Lead Date") ||
                        groupByMonth(warmLeads, "Created");
    const leadOwnerCounts = countByField(warmLeads, "Lead Owner");

    const qaScores = warmLeadQA.map((r) => Number(r.fields["Final Score"] ?? 0)).filter(Boolean);
    const avgLeadScore = qaScores.length > 0
      ? Math.round((qaScores.reduce((a, b) => a + b, 0) / qaScores.length) * 10) / 10
      : 0;
    const qaOutcomeCounts = countByField(warmLeadQA, "Outcome Result");
    const qaPassCount = qaOutcomeCounts["Pass"] ?? 0;
    const qaTotal = warmLeadQA.length;

    const leads = {
      total: warmLeads.length,
      temperatureBreakdown: leadTempCounts,
      hotLeads: leadTempCounts["Hot"] ?? 0,
      warmLeadsCount: leadTempCounts["Warm"] ?? 0,
      statusBreakdown: leadStatusCounts,
      outcomeBreakdown: leadOutcomeCounts,
      leadsWon: leadOutcomeCounts["Won!"] ?? leadOutcomeCounts["Won"] ?? 0,
      sourceBreakdown: leadSourceCounts,
      typeBreakdown: leadTypeCounts,
      locationBreakdown: leadLocationCounts,
      ownerBreakdown: leadOwnerCounts,
      byMonth: monthCounts(leadsByMonth),
      missed: missedLeads.length,
      avgLeadScore,
      qaTotal,
      qaPassCount,
      qaPassRate: pct(qaPassCount, qaTotal),
      qaOutcomes: qaOutcomeCounts,
    };

    // =================================================================
    // NATIONAL CONTRACTS
    // =================================================================
    const nationalStageCounts = countByField(nationalContractsMSA, "Stages");
    const nationalPropertyGroupCounts = countByField(nationalContractsMSA, "Property Group");
    const nationalMachineCompanyCounts = countByField(nationalContractsMSA, "Machine Company");
    const nationalRevShareCounts = countByField(nationalContractsMSA, "Rev Share Type");

    const nationalProperties = nationalContractsMSA.length;
    const completeStageCount = nationalStageCounts["Complete"] ??
                               nationalStageCounts["✅ Complete"] ?? 0;
    const nationalPipeline = nationalProperties - completeStageCount;

    const national = {
      totalMSA: nationalContractsMSA.length,
      nationalProperties,
      nationalByStage: nationalStageCounts,
      nationalByPropertyGroup: nationalPropertyGroupCounts,
      nationalByMachineCompany: nationalMachineCompanyCounts,
      nationalByRevShare: nationalRevShareCounts,
      completeContracts: completeNational.length,
      completeStageCount,
      pipelineCount: nationalPipeline,
      propertyGroups: Object.keys(nationalPropertyGroupCounts).length,
      completionRate: pct(completeStageCount, nationalProperties),
    };

    // =================================================================
    // REVENUE (refunds perspective + client revenue)
    // =================================================================
    const avgRefund = avgField(refunds, "Refund Amount") || avgField(refunds, "Amount");
    const refundsByMonth = groupByMonth(refunds, "Created");
    const refundReasons = countByField(refunds, "Main Complaint") ||
                         countByField(refunds, "Reason");
    const refundOutcomes = countByField(refunds, "Outcome");
    const refundBySalesperson = countByField(refunds, "Salesperson");
    const avgMachineVelocity = avgField(clients, "Total Machine Velocity Score");

    const revenue = {
      totalRefunds: refunds.length,
      totalRefundAmount: formatCurrency(totalRefundAmt),
      totalRefundAmountRaw: totalRefundAmt,
      avgRefund: formatCurrency(avgRefund),
      avgRefundRaw: Math.round(avgRefund * 100) / 100,
      refundsByMonth: Object.fromEntries(
        Object.entries(refundsByMonth).map(([m, recs]) => [
          m,
          { count: recs.length, amount: sumField(recs, "Refund Amount") || sumField(recs, "Amount") },
        ])
      ),
      refundReasons,
      refundOutcomes,
      refundBySalesperson,
      totalRevenue: overview.totalRevenueRaw,
      totalNetRevenue: overview.totalNetRevenueRaw,
      avgRevenuePerClient: clients.length > 0 ? Math.round(totalRevenue / clients.length) : 0,
      totalMachines,
      avgMachineVelocity: Math.round(avgMachineVelocity * 10) / 10,
      membershipRevenue: membershipLevelCounts,
    };

    // =================================================================
    // QUALITY
    // =================================================================
    const dqTypeCounts = countByField(dataQuality, "Issue Type") ||
                        countByField(dataQuality, "Category");
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

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
      },
    });
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
