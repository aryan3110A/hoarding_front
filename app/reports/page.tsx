"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";
import { dashboardAPI, enquiriesAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

const ALLOWED_ROLES = ["owner", "manager", "admin", "sales", "sales_head"];
const MANAGEMENT_ROLES = ["owner", "manager", "admin", "sales_head"];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type SalesOverview = {
  scope?: {
    visibility?: "self" | "team";
    groupBy?: "day" | "month";
    salespersonId?: string | null;
  };
  summary?: {
    recognizedRevenue?: number;
    newBusinessRevenue?: number;
    renewalRevenue?: number;
    remainingScheduledRevenue?: number;
    creditedCycles?: number;
    activeClients?: number;
    activeHoardings?: number;
    totalEnquiries?: number;
  };
  enquiryFunnel?: {
    total?: number;
    won?: number;
    inProcess?: number;
    deadFollowUpLater?: number;
    notInterested?: number;
  };
  enquirySources?: Array<{ source: string; count: number }>;
  timeline?: Array<{
    key: string;
    recognizedRevenue: number;
    newBusinessRevenue: number;
    renewalRevenue: number;
    enquiries: number;
    won?: number;
    inProcess?: number;
    deadFollowUpLater?: number;
    notInterested?: number;
    sourceCounts?: Record<string, number>;
  }>;
  salespersonBreakdown?: Array<{
    salespersonId: string;
    salespersonName: string;
    recognizedRevenue: number;
    newBusinessRevenue: number;
    renewalRevenue: number;
    remainingScheduledRevenue?: number;
    enquiries: number;
    won?: number;
    inProcess?: number;
    deadFollowUpLater?: number;
    notInterested?: number;
    creditedCycles: number;
  }>;
  marketVisitRows?: Array<{
    id: string;
    userId: string;
    userName: string;
    visitDate: string;
    visitedMarket: boolean;
    notes?: string | null;
    enquiriesCreated: number;
    walkInEnquiries: number;
    selfGeneratedEnquiries: number;
  }>;
};

type SalesClientReport = {
  scope?: {
    visibility?: "self" | "team";
    salespersonId?: string | null;
  };
  clients?: Array<{
    clientId: string;
    clientName: string;
    recognizedRevenue: number;
    newBusinessRevenue: number;
    renewalRevenue: number;
    futureScheduledRevenue: number;
    creditedCycles: number;
    hoardingsCount: number;
    nextRecognitionDate?: string | null;
    hoardings: Array<{
      hoardingId: string;
      code: string;
      city?: string | null;
      area?: string | null;
      recognizedRevenue: number;
      currentPeriodCredited?: number;
      futureScheduledRevenue: number;
      liveDate?: string | null;
      durationMonths?: number;
      perCycleCreditAmount?: number;
      totalCampaignValue?: number;
      totalCreditedSoFar?: number;
      remainingAmount?: number;
      nextCycleDate?: string | null;
      nextCycleAmount?: number;
      creditedCycles: number;
      nextRecognitionDate?: string | null;
      salesUserId?: string;
      salesUserName?: string;
      currentCycles: Array<{
        billingEventId: string;
        cycleNumber: number;
        status: string;
        recognitionDate?: string | null;
        revenue: number;
        revenueType: string;
      }>;
      schedulePreview: Array<{
        billingEventId: string;
        cycleNumber: number;
        recognitionDate?: string | null;
        monthKey: string;
        amount: number;
        periodStart?: string | null;
        periodEnd?: string | null;
      }>;
    }>;
  }>;
};

type SalesUser = {
  id: string;
  name: string;
  role?: string;
};

const toDateInput = (value: Date) => value.toISOString().slice(0, 10);

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
};

const getLastNDaysRange = (days: number) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
};

const unwrapApiData = <T,>(response: any): T => {
  if (response && typeof response === "object" && "success" in response) {
    return response.data as T;
  }
  if (response && typeof response === "object" && "data" in response) {
    return response.data as T;
  }
  return response as T;
};

const normalizeUsers = (response: any): SalesUser[] => {
  const data = unwrapApiData<any>(response);
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.users)
      ? data.users
      : Array.isArray(data?.rows)
        ? data.rows
        : [];

  return rows
    .map((row: any) => ({
      id: String(row?.id || ""),
      name: String(row?.name || "Unnamed"),
      role: String(row?.role?.name || row?.role || ""),
    }))
    .filter((row: SalesUser) => row.id)
    .filter(
      (row: SalesUser) =>
        !row.role || row.role.toLowerCase().replace(/\s+/g, "_") === "sales",
    );
};

const formatCurrency = (value?: number | null) =>
  currencyFormatter.format(Number(value || 0));

const formatCompactCurrency = (value?: number | null) =>
  compactCurrencyFormatter.format(Number(value || 0));

const formatDate = (value?: string | Date | null) => {
  if (!value) return "Not scheduled";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return dateFormatter.format(date);
};

const downloadCsv = (filename: string, rows: string[][]) => {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export default function ReportsPage() {
  const user = useUser();
  const role = String(user?.role || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  const isManagement = MANAGEMENT_ROLES.includes(role);
  const canAccess = ALLOWED_ROLES.includes(role);

  const defaultRange = useMemo(() => getCurrentMonthRange(), []);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");
  const [salespersonId, setSalespersonId] = useState("");
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [overview, setOverview] = useState<SalesOverview | null>(null);
  const [clientReport, setClientReport] = useState<SalesClientReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "clients">("overview");
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedHoardings, setExpandedHoardings] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [marketVisitDate, setMarketVisitDate] = useState(toDateInput(new Date()));
  const [visitedMarket, setVisitedMarket] = useState(true);
  const [marketVisitNotes, setMarketVisitNotes] = useState("");
  const [savingMarketVisit, setSavingMarketVisit] = useState(false);

  useEffect(() => {
    if (!user?.id || role !== "sales") return;
    setSalespersonId(user.id);
  }, [role, user?.id]);

  useEffect(() => {
    if (!user?.id || !canAccess || !isManagement) return;
    let active = true;

    const loadSalesUsers = async () => {
      try {
        const response = await enquiriesAPI.listSalesUsers();
        if (!active) return;
        setSalesUsers(normalizeUsers(response));
      } catch (error) {
        if (!active) return;
        setSalesUsers([]);
      }
    };

    void loadSalesUsers();

    return () => {
      active = false;
    };
  }, [canAccess, isManagement, user?.id]);

  useEffect(() => {
    if (!user?.id || !canAccess) return;
    let active = true;

    const loadReports = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const params = {
          startDate,
          endDate,
          groupBy,
          salespersonId: isManagement ? salespersonId || undefined : undefined,
        };

        const [overviewResponse, clientsResponse] = await Promise.all([
          dashboardAPI.getSalesPerformance(params),
          dashboardAPI.getSalesPerformanceClients({
            startDate,
            endDate,
            salespersonId: isManagement ? salespersonId || undefined : undefined,
          }),
        ]);

        if (!active) return;

        setOverview(unwrapApiData<SalesOverview>(overviewResponse));
        setClientReport(unwrapApiData<SalesClientReport>(clientsResponse));
      } catch (error) {
        if (!active) return;
        console.error("Failed to load sales performance report", error);
        setLoadError("Sales performance data could not be loaded.");
        setOverview(null);
        setClientReport(null);
        showError("Failed to load sales performance report");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReports();

    return () => {
      active = false;
    };
  }, [
    canAccess,
    endDate,
    groupBy,
    isManagement,
    refreshKey,
    salespersonId,
    startDate,
    user?.id,
  ]);

  const timeline = overview?.timeline || [];
  const enquirySources = overview?.enquirySources || [];
  const enquiryFunnel = overview?.enquiryFunnel || {};
  const salespersonBreakdown = overview?.salespersonBreakdown || [];
  const marketVisitRows = overview?.marketVisitRows || [];
  const clients = clientReport?.clients || [];

  const maxTimelineRevenue = useMemo(() => {
    return Math.max(...timeline.map((item) => Number(item.recognizedRevenue || 0)), 0);
  }, [timeline]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Recognized Revenue",
        value: formatCompactCurrency(overview?.summary?.recognizedRevenue),
        note: `${overview?.summary?.creditedCycles || 0} credited cycles`,
      },
      {
        label: "New Business",
        value: formatCompactCurrency(overview?.summary?.newBusinessRevenue),
        note: "Cycle 1 recognized revenue",
      },
      {
        label: "Renewal Revenue",
        value: formatCompactCurrency(overview?.summary?.renewalRevenue),
        note: "Cycle 2+ recognized revenue",
      },
      {
        label: "Remaining Scheduled",
        value: formatCompactCurrency(overview?.summary?.remainingScheduledRevenue),
        note: "Future cycle revenue still pending",
      },
      {
        label: "Total Enquiries",
        value: String(overview?.summary?.totalEnquiries || 0),
        note: "Captured in selected range",
      },
      {
        label: "Active Clients",
        value: String(overview?.summary?.activeClients || 0),
        note: "Clients with recognized revenue",
      },
      {
        label: "Active Hoardings",
        value: String(overview?.summary?.activeHoardings || 0),
        note: "Hoardings contributing revenue",
      },
    ],
    [overview],
  );

  const exportCurrentView = () => {
    const stamp = new Date().toISOString().slice(0, 10);

    if (activeTab === "overview") {
      const rows: string[][] = [
        [
          "Bucket",
          "Recognized Revenue",
          "New Business Revenue",
          "Renewal Revenue",
          "Enquiries",
          "Won",
          "In Process",
          "Dead / Follow up later",
          "Not Interested",
        ],
        ...timeline.map((item) => [
          item.key,
          String(item.recognizedRevenue || 0),
          String(item.newBusinessRevenue || 0),
          String(item.renewalRevenue || 0),
          String(item.enquiries || 0),
          String(item.won || 0),
          String(item.inProcess || 0),
          String(item.deadFollowUpLater || 0),
          String(item.notInterested || 0),
        ]),
        [],
        ["Monthly Business Funnel", "Count"],
        ["Total Enquiries", String(enquiryFunnel.total || 0)],
        ["Won", String(enquiryFunnel.won || 0)],
        ["In Process", String(enquiryFunnel.inProcess || 0)],
        ["Dead / Follow up later", String(enquiryFunnel.deadFollowUpLater || 0)],
        ["Not Interested", String(enquiryFunnel.notInterested || 0)],
        [],
        ["Enquiry Source", "Count"],
        ...enquirySources.map((item) => [item.source, String(item.count)]),
      ];
      downloadCsv(`sales_performance_overview_${stamp}.csv`, rows);
      return;
    }

    const rows: string[][] = [
      [
        "Client",
        "Hoarding",
        "Salesperson",
        "Credited This Period",
        "Future Scheduled Revenue",
        "Total Credited So Far",
        "Remaining Amount",
        "Credited Cycles",
        "Next Recognition Date",
      ],
    ];

    clients.forEach((client) => {
      client.hoardings.forEach((hoarding) => {
        rows.push([
          client.clientName,
          hoarding.code,
          hoarding.salesUserName || "Unassigned",
          String(hoarding.currentPeriodCredited || hoarding.recognizedRevenue || 0),
          String(hoarding.futureScheduledRevenue || 0),
          String(hoarding.totalCreditedSoFar || 0),
          String(hoarding.remainingAmount || 0),
          String(hoarding.creditedCycles || 0),
          formatDate(hoarding.nextRecognitionDate),
        ]);
      });
    });

    downloadCsv(`sales_performance_clients_${stamp}.csv`, rows);
  };

  const applyRange = (mode: "month" | "30d" | "90d") => {
    const range =
      mode === "month" ? getCurrentMonthRange() : getLastNDaysRange(mode === "30d" ? 30 : 90);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setGroupBy(mode === "90d" ? "month" : "day");
  };

  const toggleClient = (clientId: string) => {
    setExpandedClients((current) => ({
      ...current,
      [clientId]: !current[clientId],
    }));
  };

  const toggleHoarding = (clientId: string, hoardingId: string) => {
    const key = `${clientId}:${hoardingId}`;
    setExpandedHoardings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const saveMarketVisit = async () => {
    try {
      setSavingMarketVisit(true);
      await dashboardAPI.saveSalesMarketVisit({
        visitDate: marketVisitDate,
        visitedMarket,
        notes: marketVisitNotes || undefined,
      });
      showSuccess("Market visit saved");
      setRefreshKey((current) => current + 1);
    } catch (error: any) {
      showError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to save market visit",
      );
    } finally {
      setSavingMarketVisit(false);
    }
  };

  if (!user) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
        <h3>Loading reports</h3>
        <p>Preparing sales performance data.</p>
      </div>
    );
  }

  if (!canAccess) {
    return <AccessDenied />;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1>Sales Performance</h1>
          <p style={{ maxWidth: "760px" }}>
            Revenue recognition, enquiry activity, and client-wise performance using the live billing-event engine.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => applyRange("month")}>
            This Month
          </button>
          <button className="btn btn-secondary" onClick={() => applyRange("30d")}>
            Last 30 Days
          </button>
          <button className="btn btn-secondary" onClick={() => applyRange("90d")}>
            Last 90 Days
          </button>
          <button className="btn btn-primary" onClick={exportCurrentView} disabled={loading}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="card">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isManagement ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
            gap: "16px",
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Group By</label>
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as "day" | "month")}
            >
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
          </div>
          {isManagement && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Salesperson</label>
              <select
                value={salespersonId}
                onChange={(event) => setSalespersonId(event.target.value)}
              >
                <option value="">All Sales Users</option>
                {salesUsers.map((salesUser) => (
                  <option key={salesUser.id} value={salesUser.id}>
                    {salesUser.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginTop: "16px",
          }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            {overview?.scope?.visibility === "team"
              ? "Team-wide view for management roles."
              : "Your personal sales performance view."}
          </p>
          <div className="tab-bar" style={{ marginBottom: 0 }}>
            <button
              className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              className={`tab-button ${activeTab === "clients" ? "active" : ""}`}
              onClick={() => setActiveTab("clients")}
            >
              Client View
            </button>
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="card" style={{ borderColor: "rgba(239, 68, 68, 0.35)" }}>
          <h3 style={{ color: "var(--danger-color)" }}>Unable to load report</h3>
          <p>{loadError}</p>
        </div>
      ) : null}

      <div className="grid">
        {summaryCards.map((card) => (
          <div key={card.label} className="stat-card">
            <h3>{card.value}</h3>
            <p>{card.label}</p>
            <div style={{ marginTop: "10px", color: "var(--text-secondary)", fontSize: "13px" }}>
              {card.note}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "56px 24px" }}>
          <h3>Refreshing sales performance</h3>
          <p>Pulling revenue, enquiry, and client rollups.</p>
        </div>
      ) : activeTab === "overview" ? (
        <>
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3>Revenue Timeline</h3>
                <p>Recognized revenue and enquiry volume across the selected range.</p>
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Bucketed by {overview?.scope?.groupBy || groupBy}
              </div>
            </div>

            {timeline.length > 0 ? (
              <div style={{ display: "grid", gap: "12px", marginTop: "20px" }}>
                {timeline.map((item) => {
                  const width =
                    maxTimelineRevenue > 0
                      ? Math.max((Number(item.recognizedRevenue || 0) / maxTimelineRevenue) * 100, 4)
                      : 4;
                  return (
                    <div
                      key={item.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px minmax(0, 1fr) 140px",
                        gap: "16px",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.key}</div>
                      <div
                        style={{
                          height: "14px",
                          borderRadius: "999px",
                          background: "rgba(31, 92, 169, 0.08)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${width}%`,
                            height: "100%",
                            borderRadius: "999px",
                            background:
                              "linear-gradient(90deg, var(--brand-orange) 0%, var(--brand-yellow) 100%)",
                          }}
                        />
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatCurrency(item.recognizedRevenue)}
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                          {item.enquiries || 0} enquiries
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <p>No recognized revenue or enquiries found for this range.</p>
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "24px",
              alignItems: "start",
            }}
          >
            <div className="card" style={{ marginBottom: 0 }}>
              <h3>Monthly Business Funnel</h3>
              <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
                {[
                  ["Total enquiries", enquiryFunnel.total || 0],
                  ["Won", enquiryFunnel.won || 0],
                  ["In process", enquiryFunnel.inProcess || 0],
                  ["Dead / Follow up later", enquiryFunnel.deadFollowUpLater || 0],
                  ["Not interested", enquiryFunnel.notInterested || 0],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 16px",
                      border: "1px solid rgba(31, 92, 169, 0.12)",
                      borderRadius: "14px",
                      background: "rgba(255, 255, 255, 0.72)",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
                    <div style={{ color: "var(--brand-blue)", fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <h3>Enquiry Sources</h3>
              {enquirySources.length > 0 ? (
                <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
                  {enquirySources.map((item) => (
                    <div
                      key={item.source}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        padding: "14px 16px",
                        border: "1px solid rgba(31, 92, 169, 0.12)",
                        borderRadius: "14px",
                        background: "rgba(255, 255, 255, 0.72)",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.source}</div>
                      <div
                        style={{
                          minWidth: "44px",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          background: "rgba(0, 187, 241, 0.12)",
                          color: "var(--brand-blue)",
                          textAlign: "center",
                          fontWeight: 700,
                        }}
                      >
                        {item.count}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ marginTop: "16px" }}>No enquiry-source mix is available for this range.</p>
              )}
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <h3>Market Visit Tracker</h3>
              {role === "sales" ? (
                <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Visit Date</label>
                    <input
                      type="date"
                      value={marketVisitDate}
                      onChange={(event) => setMarketVisitDate(event.target.value)}
                    />
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visitedMarket}
                      onChange={(event) => setVisitedMarket(event.target.checked)}
                    />
                    Visited market today
                  </label>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Notes</label>
                    <textarea
                      value={marketVisitNotes}
                      rows={3}
                      onChange={(event) => setMarketVisitNotes(event.target.value)}
                      placeholder="Optional market note or random-approach summary"
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={saveMarketVisit}
                    disabled={savingMarketVisit}
                  >
                    {savingMarketVisit ? "Saving..." : "Save Market Visit"}
                  </button>
                </div>
              ) : (
                <p style={{ marginTop: "16px" }}>
                  Market-visit logs are entered by each sales person and visible here for supervision.
                </p>
              )}
              <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
                {marketVisitRows.slice(0, 5).map((row) => (
                  <div
                    key={row.id}
                    style={{
                      padding: "12px 14px",
                      border: "1px solid rgba(31, 92, 169, 0.12)",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.72)",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                      {row.userName} · {formatDate(row.visitDate)}
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
                      {row.visitedMarket ? "Visited market" : "No market visit"} · {row.enquiriesCreated} enquiries · Walk In {row.walkInEnquiries} · Self Generated {row.selfGeneratedEnquiries}
                    </div>
                    {row.notes ? (
                      <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "6px" }}>
                        {row.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
                {marketVisitRows.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)" }}>No market visits logged in this range.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: "24px" }}>
            <h3>{isManagement ? "Salesperson Breakdown" : "Your Revenue Split"}</h3>
            {salespersonBreakdown.length > 0 ? (
              <div style={{ overflowX: "auto", marginTop: "16px" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Salesperson</th>
                      <th>Recognized Revenue</th>
                      <th>Remaining Scheduled</th>
                      <th>New Business</th>
                      <th>Renewal</th>
                      <th>Enquiries</th>
                      <th>Won</th>
                      <th>In Process</th>
                      <th>Dead / Follow up later</th>
                      <th>Not Interested</th>
                      <th>Credited Cycles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salespersonBreakdown.map((row) => (
                      <tr key={row.salespersonId}>
                        <td>{row.salespersonName}</td>
                        <td>{formatCurrency(row.recognizedRevenue)}</td>
                        <td>{formatCurrency(row.remainingScheduledRevenue)}</td>
                        <td>{formatCurrency(row.newBusinessRevenue)}</td>
                        <td>{formatCurrency(row.renewalRevenue)}</td>
                        <td>{row.enquiries || 0}</td>
                        <td>{row.won || 0}</td>
                        <td>{row.inProcess || 0}</td>
                        <td>{row.deadFollowUpLater || 0}</td>
                        <td>{row.notInterested || 0}</td>
                        <td>{row.creditedCycles || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ marginTop: "16px" }}>No salesperson breakdown is available yet.</p>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "20px",
            }}
          >
            <div>
              <h3>Client-First Revenue View</h3>
              <p>Expand a client to inspect hoarding-level revenue and cycle-level recognition.</p>
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
              {clients.length} client groups
            </div>
          </div>

          {clients.length > 0 ? (
            <div style={{ display: "grid", gap: "16px" }}>
              {clients.map((client) => {
                const isExpanded = Boolean(expandedClients[client.clientId]);
                return (
                  <div
                    key={client.clientId}
                    style={{
                      border: "1px solid rgba(31, 92, 169, 0.12)",
                      borderRadius: "18px",
                      overflow: "hidden",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.94))",
                    }}
                  >
                    <button
                      onClick={() => toggleClient(client.clientId)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        padding: "20px 22px",
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1.4fr) repeat(4, minmax(120px, 1fr)) 48px",
                        gap: "16px",
                        alignItems: "center",
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{client.clientName}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "6px" }}>
                          {client.hoardingsCount} hoardings · {client.creditedCycles} credited cycles
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Recognized</div>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatCurrency(client.recognizedRevenue)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>New Business</div>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatCurrency(client.newBusinessRevenue)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Renewal</div>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatCurrency(client.renewalRevenue)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Future</div>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatCurrency(client.futureScheduledRevenue)}
                        </div>
                      </div>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "999px",
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(31, 92, 169, 0.08)",
                          color: "var(--brand-blue)",
                          fontWeight: 700,
                        }}
                      >
                        {isExpanded ? "−" : "+"}
                      </div>
                    </button>

                    {isExpanded ? (
                      <div style={{ padding: "0 22px 22px", borderTop: "1px solid rgba(31, 92, 169, 0.08)" }}>
                        <div style={{ overflowX: "auto", marginTop: "16px" }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Hoarding</th>
                                <th>Salesperson</th>
                                <th>Live Date</th>
                                <th>Duration</th>
                                <th>Per-cycle Credit</th>
                                <th>Credited This Period</th>
                                <th>Total Credited So Far</th>
                                <th>Remaining</th>
                                <th>Next Cycle</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {client.hoardings.map((hoarding) => {
                                const expandedKey = `${client.clientId}:${hoarding.hoardingId}`;
                                const hoardingExpanded = Boolean(expandedHoardings[expandedKey]);
                                return (
                                  <>
                                    <tr key={expandedKey}>
                                      <td>
                                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                          {hoarding.code}
                                        </div>
                                        <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                                          {[hoarding.city, hoarding.area].filter(Boolean).join(", ") || "Location pending"}
                                        </div>
                                      </td>
                                      <td>{hoarding.salesUserName || "Unassigned"}</td>
                                      <td>{formatDate(hoarding.liveDate)}</td>
                                      <td>{hoarding.durationMonths || 0} months</td>
                                      <td>{formatCurrency(hoarding.perCycleCreditAmount)}</td>
                                      <td>{formatCurrency(hoarding.currentPeriodCredited)}</td>
                                      <td>{formatCurrency(hoarding.totalCreditedSoFar)}</td>
                                      <td>{formatCurrency(hoarding.remainingAmount)}</td>
                                      <td>
                                        <div>{formatDate(hoarding.nextCycleDate || hoarding.nextRecognitionDate)}</div>
                                        <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                                          {formatCurrency(hoarding.nextCycleAmount)}
                                        </div>
                                      </td>
                                      <td style={{ textAlign: "right" }}>
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: "8px 14px" }}
                                          onClick={() => toggleHoarding(client.clientId, hoarding.hoardingId)}
                                        >
                                          {hoardingExpanded ? "Hide Cycles" : "Show Cycles"}
                                        </button>
                                      </td>
                                    </tr>
                                    {hoardingExpanded ? (
                                      <tr key={`${expandedKey}:cycles`}>
                                        <td colSpan={9} style={{ background: "rgba(31, 92, 169, 0.03)" }}>
                                          <div style={{ display: "grid", gap: "10px", padding: "12px 0" }}>
                                            <div
                                              style={{
                                                display: "grid",
                                                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                                gap: "12px",
                                              }}
                                            >
                                              <div className="card" style={{ marginBottom: 0, padding: "16px" }}>
                                                <h4>Total Campaign Value</h4>
                                                <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                                                  {formatCurrency(hoarding.totalCampaignValue)}
                                                </div>
                                              </div>
                                              <div className="card" style={{ marginBottom: 0, padding: "16px" }}>
                                                <h4>Total Credited</h4>
                                                <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                                                  {formatCurrency(hoarding.totalCreditedSoFar)}
                                                </div>
                                              </div>
                                              <div className="card" style={{ marginBottom: 0, padding: "16px" }}>
                                                <h4>Remaining</h4>
                                                <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                                                  {formatCurrency(hoarding.remainingAmount)}
                                                </div>
                                              </div>
                                              <div className="card" style={{ marginBottom: 0, padding: "16px" }}>
                                                <h4>Cycle Credit</h4>
                                                <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                                                  {formatCurrency(hoarding.perCycleCreditAmount)}
                                                </div>
                                              </div>
                                            </div>

                                            {hoarding.currentCycles.length > 0 ? (
                                              hoarding.currentCycles.map((cycle) => (
                                                <div
                                                  key={cycle.billingEventId}
                                                  style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                                                    gap: "12px",
                                                    padding: "14px 16px",
                                                    border: "1px solid rgba(31, 92, 169, 0.08)",
                                                    borderRadius: "14px",
                                                    background: "white",
                                                  }}
                                                >
                                                  <div>
                                                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                                      Cycle
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                      {cycle.cycleNumber}
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                                      Revenue Type
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                      {cycle.revenueType === "new_business" ? "New Business" : "Renewal"}
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                                      Status
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                      {cycle.status}
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                                      Recognition Date
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                      {formatDate(cycle.recognitionDate)}
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                                      Revenue
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                      {formatCurrency(cycle.revenue)}
                                                    </div>
                                                  </div>
                                                </div>
                                              ))
                                            ) : (
                                              <div style={{ padding: "12px 0", color: "var(--text-secondary)" }}>
                                                No credited cycles were found for this selected period.
                                              </div>
                                            )}

                                            <div style={{ paddingTop: "8px" }}>
                                              <h4 style={{ marginBottom: "12px" }}>Future Schedule Preview</h4>
                                              {hoarding.schedulePreview.length > 0 ? (
                                                <div style={{ display: "grid", gap: "10px" }}>
                                                  {hoarding.schedulePreview.map((schedule) => (
                                                    <div
                                                      key={schedule.billingEventId}
                                                      style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                                                        gap: "12px",
                                                        padding: "14px 16px",
                                                        border: "1px solid rgba(31, 92, 169, 0.08)",
                                                        borderRadius: "14px",
                                                        background: "white",
                                                      }}
                                                    >
                                                      <div>
                                                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                                          Cycle
                                                        </div>
                                                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                          {schedule.cycleNumber}
                                                        </div>
                                                      </div>
                                                      <div>
                                                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                                          Credit Month
                                                        </div>
                                                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                          {schedule.monthKey}
                                                        </div>
                                                      </div>
                                                      <div>
                                                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                                          Recognition Date
                                                        </div>
                                                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                          {formatDate(schedule.recognitionDate)}
                                                        </div>
                                                      </div>
                                                      <div>
                                                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                                          Period
                                                        </div>
                                                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                          {formatDate(schedule.periodStart)} - {formatDate(schedule.periodEnd)}
                                                        </div>
                                                      </div>
                                                      <div>
                                                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                                          Amount
                                                        </div>
                                                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                          {formatCurrency(schedule.amount)}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <div style={{ color: "var(--text-secondary)" }}>
                                                  No future schedule remains for this hoarding.
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    ) : null}
                                  </>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "56px 24px" }}>
              <h3>No client revenue groups yet</h3>
              <p>No recognized or future revenue events matched the current filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
