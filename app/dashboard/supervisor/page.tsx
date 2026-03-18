"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/components/AppLayout";
import CustomSelect from "@/components/CustomSelect";
import { supervisorAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

type ExecutionTab = "pending" | "live" | "remounting" | "unmounting";

type ExecutionImage = {
  image_url?: string;
  filename?: string;
  timestamp?: string;
  uploaded_by?: string;
  type?: string;
};

type BoardRow = {
  id: string;
  code?: string | null;
  city?: string | null;
  area?: string | null;
  landmark?: string | null;
  roadName?: string | null;
  status?: string | null;
  executionStatus?: string | null;
  remountStatus?: string | null;
  plannedLiveDate?: string | null;
  expiryDate?: string | null;
  clientName?: string | null;
  executionType?: string | null;
  groupKey?: string | null;
  executionImages?: ExecutionImage[];
  supervisorChecklist?: {
    isCorrectSize?: boolean | null;
    isGoodCondition?: boolean | null;
    isFlexReceived?: boolean | null;
    isReadyForInstall?: boolean | null;
    isSiteImageUploaded?: boolean | null;
  } | null;
};

type ChecklistDraft = {
  isCorrectSize: boolean;
  isGoodCondition: boolean;
  isFlexReceived: boolean;
  isReadyForInstall: boolean;
  isSiteImageUploaded: boolean;
};

type GroupRow = {
  key: string;
  label: string;
  rows: BoardRow[];
};

const tabOptions: Array<{ value: ExecutionTab; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "live", label: "Live" },
  { value: "remounting", label: "Re-mounting" },
  { value: "unmounting", label: "Unmounting" },
];

const statusStyle = (status?: string | null) => {
  const s = String(status || "").toLowerCase();
  if (s === "received")
    return { text: "Received", bg: "#d1fae5", fg: "#065f46" };
  if (s === "live") return { text: "Live", bg: "#dcfce7", fg: "#166534" };
  if (s === "remount_pending")
    return { text: "Remount Pending", bg: "#fee2e2", fg: "#991b1b" };
  if (s === "remounted")
    return { text: "Remounted", bg: "#e0f2fe", fg: "#075985" };
  if (s === "unmount_pending")
    return { text: "Unmount Pending", bg: "#fef3c7", fg: "#92400e" };
  if (s === "unmounted")
    return { text: "Unmounted", bg: "#f1f5f9", fg: "#0f172a" };
  return { text: "Pending", bg: "#e5e7eb", fg: "#374151" };
};

const executionTypeLabel = (et?: string | null) => {
  if (!et) return "-";
  const map: Record<string, string> = {
    CLIENT_CDR: "Client CDR",
    IN_HOUSE_DESIGN: "In-House Design",
    CLIENT_DIRECT_FLEX: "Client Direct Flex",
  };
  return map[et] || et;
};

const formatDate = (raw?: string | null) => {
  if (!raw) return "-";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN");
};

const formatDateInput = (raw?: string | null) => {
  if (!raw) return "";
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const statusFilterOptions: Record<
  ExecutionTab,
  Array<{ value: string; label: string }>
> = {
  pending: [
    { value: "", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "received", label: "Received" },
  ],
  live: [
    { value: "", label: "All Statuses" },
    { value: "live", label: "Live" },
  ],
  remounting: [
    { value: "", label: "All Statuses" },
    { value: "remount_pending", label: "Remount Pending" },
  ],
  unmounting: [
    { value: "", label: "All Statuses" },
    { value: "unmount_pending", label: "Unmount Pending" },
    { value: "unmounted", label: "Unmounted" },
  ],
};

export default function SupervisorExecutionBoardPage() {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const role = String(user?.role || "").toLowerCase();
  const canManage = ["supervisor", "owner", "manager", "admin"].includes(role);
  const canViewBoard = canManage || role === "sales";

  const [activeTab, setActiveTab] = useState<ExecutionTab>("pending");
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  // Filters
  const [selectedClientKey, setSelectedClientKey] = useState("all");
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedImageRow, setExpandedImageRow] = useState<string | null>(null);
  const [checklistDraftById, setChecklistDraftById] = useState<
    Record<string, Partial<ChecklistDraft>>
  >({});

  const setTabAndRoute = useCallback(
    (nextTab: ExecutionTab) => {
      setActiveTab(nextTab);
      setPage(1);
      setSelectedClientKey("all");
      setCityFilter("");
      setStatusFilter("");
      setDateFrom("");
      setDateTo("");
      setExpandedImageRow(null);
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", nextTab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const raw = String(searchParams?.get("tab") || "")
      .trim()
      .toLowerCase();
    if (
      raw === "pending" ||
      raw === "live" ||
      raw === "remounting" ||
      raw === "unmounting"
    ) {
      setActiveTab(raw as ExecutionTab);
    }
  }, [searchParams]);

  const loadBoard = async () => {
    if (!canViewBoard) return;
    try {
      setLoading(true);
      const params: Record<string, any> = {
        tab: activeTab,
        page,
        limit,
      };
      if (cityFilter.trim()) params.city = cityFilter.trim();
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const resp = await supervisorAPI.getExecutionBoard(params);
      if (resp?.success) {
        const payload = resp?.data || {};
        setRows(Array.isArray(payload.rows) ? payload.rows : []);
        setTotal(Number(payload.total || 0));
      } else {
        setRows([]);
        setTotal(0);
        showError(resp?.message || "Failed to load status board");
      }
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      showError(e?.response?.data?.message || "Failed to load status board");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canViewBoard,
    activeTab,
    page,
    cityFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  // Group rows by client or city
  const groupedRows = useMemo<GroupRow[]>(() => {
    const map = new Map<string, GroupRow>();
    for (const row of rows) {
      const key =
        String(
          activeTab === "unmounting"
            ? row.city || "Unknown City"
            : row.clientName || "Unknown Client",
        ) || "Unknown";
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(key, {
          key,
          label: key,
          rows: [row],
        });
      }
    }
    return Array.from(map.values());
  }, [rows, activeTab]);

  const clientOptions = useMemo(
    () => [
      {
        value: "all",
        label: activeTab === "unmounting" ? "All Cities" : "All Clients",
      },
      ...groupedRows.map((g) => ({ value: g.key, label: g.label })),
    ],
    [groupedRows, activeTab],
  );

  const filteredGroups = useMemo(() => {
    if (selectedClientKey === "all") return groupedRows;
    return groupedRows.filter((g) => g.key === selectedClientKey);
  }, [groupedRows, selectedClientKey]);

  const visibleRows = useMemo(
    () => filteredGroups.reduce((acc, g) => acc + g.rows.length, 0),
    [filteredGroups],
  );

  // Unique cities for the city filter dropdown
  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    for (const row of rows) {
      if (row.city) cities.add(row.city);
    }
    return [
      { value: "", label: "All Cities" },
      ...Array.from(cities)
        .sort()
        .map((c) => ({ value: c, label: c })),
    ];
  }, [rows]);

  const updateExecutionStatus = async (id: string, next: string) => {
    if (!canManage) return;
    try {
      setProcessingId(id);
      const resp = await supervisorAPI.updateExecutionStatus(id, next as any);
      if (resp?.success) {
        showSuccess("Status updated");
        await loadBoard();
      } else {
        showError(resp?.message || "Failed to update status");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to update status");
    } finally {
      setProcessingId(null);
    }
  };

  const uploadExecutionImages = async (
    id: string,
    type: "mount" | "remount" | "unmount",
    files: FileList | null,
  ) => {
    if (!canManage || !files || files.length === 0) return;
    try {
      setProcessingId(id);
      const resp = await supervisorAPI.uploadExecutionImages(
        id,
        type,
        Array.from(files),
      );
      if (resp?.success) {
        const updatedChecklist = resp?.data || null;
        const updatedSiteImages = Array.isArray(updatedChecklist?.siteImages)
          ? (updatedChecklist.siteImages as ExecutionImage[])
          : null;
        setRows((prev) =>
          (prev || []).map((row) =>
            row.id === id
              ? {
                  ...row,
                  executionImages:
                    updatedSiteImages || row.executionImages || [],
                  supervisorChecklist: {
                    ...(row.supervisorChecklist || {}),
                    isSiteImageUploaded: true,
                  },
                }
              : row,
          ),
        );
        showSuccess("Images uploaded");
      } else {
        showError(resp?.message || "Failed to upload images");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to upload images");
    } finally {
      setProcessingId(null);
    }
  };

  const getImagesForRow = (
    row: BoardRow,
    imgType?: string,
  ): ExecutionImage[] => {
    const imgs = Array.isArray(row.executionImages) ? row.executionImages : [];
    if (!imgType) return imgs;
    return imgs.filter((img) => img.type === imgType);
  };

  const hasRemountPending = (row: BoardRow) => {
    const rs = String(row.remountStatus || "").toUpperCase();
    return rs === "PENDING";
  };

  const clearFilters = () => {
    setSelectedClientKey("all");
    setCityFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    cityFilter ||
    statusFilter ||
    dateFrom ||
    dateTo ||
    selectedClientKey !== "all";

  const resolveChecklist = (row: BoardRow): ChecklistDraft => {
    const base = row.supervisorChecklist || {};
    const draft = checklistDraftById[row.id] || {};
    return {
      isCorrectSize: Boolean(
        typeof draft.isCorrectSize === "boolean"
          ? draft.isCorrectSize
          : base.isCorrectSize,
      ),
      isGoodCondition: Boolean(
        typeof draft.isGoodCondition === "boolean"
          ? draft.isGoodCondition
          : base.isGoodCondition,
      ),
      isFlexReceived: Boolean(
        typeof draft.isFlexReceived === "boolean"
          ? draft.isFlexReceived
          : base.isFlexReceived,
      ),
      isReadyForInstall: Boolean(
        typeof draft.isReadyForInstall === "boolean"
          ? draft.isReadyForInstall
          : base.isReadyForInstall,
      ),
      isSiteImageUploaded: Boolean(base.isSiteImageUploaded),
    };
  };

  const isChecklistComplete = (checklist: ChecklistDraft) => {
    return (
      checklist.isCorrectSize &&
      checklist.isGoodCondition &&
      checklist.isFlexReceived &&
      checklist.isReadyForInstall &&
      checklist.isSiteImageUploaded
    );
  };

  const updateChecklistDraft = (
    hoardingId: string,
    field:
      | "isCorrectSize"
      | "isGoodCondition"
      | "isFlexReceived"
      | "isReadyForInstall",
    value: boolean,
  ) => {
    setChecklistDraftById((prev) => ({
      ...(prev || {}),
      [hoardingId]: {
        ...(prev?.[hoardingId] || {}),
        [field]: value,
      },
    }));
  };

  const persistChecklist = async (
    row: BoardRow,
    silent = false,
  ): Promise<boolean> => {
    if (!canManage) return false;
    const checklist = resolveChecklist(row);
    try {
      setProcessingId(row.id);
      const resp = await supervisorAPI.updateChecklist(row.id, {
        isCorrectSize: checklist.isCorrectSize,
        isGoodCondition: checklist.isGoodCondition,
        isFlexReceived: checklist.isFlexReceived,
        isReadyForInstall: checklist.isReadyForInstall,
      });
      if (resp?.success === false) {
        showError(resp?.message || "Failed to save checklist");
        return false;
      }
      const updatedChecklist = resp?.data || null;
      setRows((prev) =>
        (prev || []).map((r) =>
          r.id === row.id
            ? {
                ...r,
                supervisorChecklist: {
                  ...(r.supervisorChecklist || {}),
                  isCorrectSize: Boolean(updatedChecklist?.isCorrectSize),
                  isGoodCondition: Boolean(updatedChecklist?.isGoodCondition),
                  isFlexReceived: Boolean(updatedChecklist?.isFlexReceived),
                  isReadyForInstall: Boolean(
                    updatedChecklist?.isReadyForInstall,
                  ),
                  isSiteImageUploaded: Boolean(
                    typeof updatedChecklist?.isSiteImageUploaded === "boolean"
                      ? updatedChecklist.isSiteImageUploaded
                      : r.supervisorChecklist?.isSiteImageUploaded,
                  ),
                },
              }
            : r,
        ),
      );
      setChecklistDraftById((prev) => {
        const next = { ...(prev || {}) };
        delete next[row.id];
        return next;
      });
      if (!silent) showSuccess("Checklist saved");
      return true;
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to save checklist");
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const saveChecklist = async (row: BoardRow) => {
    await persistChecklist(row, false);
  };

  return (
    <ProtectedRoute component="hoardings">
      <div className="page-container">
        <h1 style={{ marginBottom: "12px" }}>Execution Board</h1>
        <p style={{ marginBottom: "20px", color: "var(--text-secondary)" }}>
          Track pending, live, re-mounting and unmounting hoardings.
        </p>

        {!canViewBoard ? (
          <div className="card">You are not allowed to access this module.</div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              {tabOptions.map((tab) => (
                <button
                  key={tab.value}
                  className={
                    activeTab === tab.value
                      ? "btn btn-primary"
                      : "btn btn-tab-inactive"
                  }
                  onClick={() => setTabAndRoute(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filters Row */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "14px",
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              {/* Client/City group filter */}
              <div style={{ minWidth: 200, flex: "1 1 200px", maxWidth: 300 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 4,
                    display: "block",
                  }}
                >
                  {activeTab === "unmounting" ? "City Group" : "Client"}
                </label>
                <CustomSelect
                  value={selectedClientKey}
                  onChange={(v) => {
                    setSelectedClientKey(v);
                    setPage(1);
                  }}
                  options={clientOptions}
                />
              </div>

              {/* City filter (for non-unmounting tabs) */}
              {activeTab !== "unmounting" && (
                <div style={{ minWidth: 160, flex: "0 1 200px" }}>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      marginBottom: 4,
                      display: "block",
                    }}
                  >
                    City
                  </label>
                  <CustomSelect
                    value={cityFilter}
                    onChange={(v) => {
                      setCityFilter(v);
                      setPage(1);
                    }}
                    options={cityOptions}
                  />
                </div>
              )}

              {/* Status filter */}
              <div style={{ minWidth: 160, flex: "0 1 200px" }}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 4,
                    display: "block",
                  }}
                >
                  Status
                </label>
                <CustomSelect
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                  options={statusFilterOptions[activeTab]}
                />
              </div>

              {/* Date Range */}
              <div style={{ minWidth: 140, flex: "0 1 160px" }}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 4,
                    display: "block",
                  }}
                >
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div style={{ minWidth: 140, flex: "0 1 160px" }}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 4,
                    display: "block",
                  }}
                >
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>

              {hasActiveFilters && (
                <div style={{ flex: "0 0 auto", paddingBottom: 1 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={clearFilters}
                    style={{ fontSize: 12 }}
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>

            {/* Summary Card */}
            <div className="card" style={{ marginBottom: "14px" }}>
              <strong>
                {activeTab === "pending"
                  ? "Total Pending Clients:"
                  : activeTab === "live"
                    ? "Total Live Clients:"
                    : activeTab === "remounting"
                      ? "Total Re-mounting Clients:"
                      : "Total Unmounting Cities:"}
              </strong>{" "}
              {filteredGroups.length}
              &nbsp; | &nbsp; <strong>No. of Hoardings:</strong> {visibleRows}
            </div>

            {/* Data Table */}
            <div className="card">
              {loading ? (
                <div style={{ textAlign: "center", padding: "24px" }}>
                  Loading hoardings...
                </div>
              ) : filteredGroups.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "var(--text-secondary)",
                  }}
                >
                  No hoardings found
                  {hasActiveFilters ? " for the selected filters" : ""}.
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <div key={group.key} style={{ marginBottom: 16 }}>
                    <h3
                      style={{
                        marginBottom: 8,
                        borderBottom: "1px solid #e2e8f0",
                        paddingBottom: 6,
                      }}
                    >
                      {activeTab === "unmounting"
                        ? `City: ${group.label}`
                        : `Client: ${group.label}`}
                      <span
                        style={{
                          fontWeight: 400,
                          fontSize: 13,
                          color: "#64748b",
                          marginLeft: 8,
                        }}
                      >
                        ({group.rows.length} hoarding
                        {group.rows.length !== 1 ? "s" : ""})
                      </span>
                    </h3>

                    <div style={{ overflowX: "auto" }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>City</th>
                            <th>Location</th>
                            <th>Exec Type</th>
                            <th>Execution Status</th>
                            <th>Planned Live</th>
                            <th>Expiry</th>
                            <th>Images</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => {
                            const badge = statusStyle(row.executionStatus);
                            const isBusy = processingId === row.id;
                            const isRemountRow =
                              activeTab === "live" && hasRemountPending(row);
                            const allImages = getImagesForRow(row);
                            const isExpanded = expandedImageRow === row.id;
                            const checklist = resolveChecklist(row);
                            const checklistReady =
                              isChecklistComplete(checklist);
                            const hasChecklistDraft =
                              Object.keys(checklistDraftById[row.id] || {})
                                .length > 0;
                            const canMarkLive = checklistReady;

                            return (
                              <>
                                <tr
                                  key={row.id}
                                  style={
                                    isRemountRow
                                      ? {
                                          background: "#fff7ed",
                                          borderLeft: "3px solid #f97316",
                                        }
                                      : undefined
                                  }
                                >
                                  <td style={{ fontWeight: 600 }}>
                                    {row.code || row.id}
                                  </td>
                                  <td>{row.city || "-"}</td>
                                  <td>
                                    {[row.area, row.landmark || row.roadName]
                                      .filter(Boolean)
                                      .join(", ") || "-"}
                                  </td>
                                  <td style={{ fontSize: 12 }}>
                                    {executionTypeLabel(row.executionType)}
                                  </td>
                                  <td>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 4,
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                      }}
                                    >
                                      <span
                                        style={{
                                          background: badge.bg,
                                          color: badge.fg,
                                          borderRadius: 999,
                                          padding: "4px 10px",
                                          fontSize: 12,
                                          fontWeight: 600,
                                        }}
                                      >
                                        {badge.text}
                                      </span>
                                      {isRemountRow && (
                                        <span
                                          style={{
                                            background: "#fee2e2",
                                            color: "#991b1b",
                                            borderRadius: 999,
                                            padding: "3px 8px",
                                            fontSize: 11,
                                            fontWeight: 600,
                                          }}
                                        >
                                          Remount Pending
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td>{formatDate(row.plannedLiveDate)}</td>
                                  <td>{formatDate(row.expiryDate)}</td>
                                  <td>
                                    {allImages.length > 0 ? (
                                      <button
                                        className="btn btn-secondary"
                                        style={{
                                          fontSize: 11,
                                          padding: "2px 8px",
                                        }}
                                        onClick={() =>
                                          setExpandedImageRow(
                                            isExpanded ? null : row.id,
                                          )
                                        }
                                      >
                                        {isExpanded
                                          ? "Hide"
                                          : `View (${allImages.length})`}
                                      </button>
                                    ) : (
                                      <span
                                        style={{
                                          color: "#94a3b8",
                                          fontSize: 12,
                                        }}
                                      >
                                        None
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {!canManage ? (
                                      <span
                                        style={{
                                          color: "#64748b",
                                          fontSize: 12,
                                        }}
                                      >
                                        View only
                                      </span>
                                    ) : (
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 8,
                                          flexWrap: "wrap",
                                          alignItems: "center",
                                        }}
                                      >
                                        {activeTab === "pending" ? (
                                          <>
                                            <div
                                              style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 6,
                                                minWidth: 260,
                                              }}
                                            >
                                              <div
                                                style={{
                                                  display: "grid",
                                                  gridTemplateColumns:
                                                    "repeat(2, minmax(120px, 1fr))",
                                                  gap: 4,
                                                }}
                                              >
                                                <label
                                                  style={{
                                                    fontSize: 12,
                                                    color:
                                                      "var(--text-primary)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                  }}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={
                                                      checklist.isCorrectSize
                                                    }
                                                    disabled={isBusy}
                                                    onChange={(e) =>
                                                      updateChecklistDraft(
                                                        row.id,
                                                        "isCorrectSize",
                                                        e.target.checked,
                                                      )
                                                    }
                                                  />
                                                  Size OK
                                                </label>
                                                <label
                                                  style={{
                                                    fontSize: 12,
                                                    color:
                                                      "var(--text-primary)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                  }}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={
                                                      checklist.isGoodCondition
                                                    }
                                                    disabled={isBusy}
                                                    onChange={(e) =>
                                                      updateChecklistDraft(
                                                        row.id,
                                                        "isGoodCondition",
                                                        e.target.checked,
                                                      )
                                                    }
                                                  />
                                                  Good Condition
                                                </label>
                                                <label
                                                  style={{
                                                    fontSize: 12,
                                                    color:
                                                      "var(--text-primary)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                  }}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={
                                                      checklist.isFlexReceived
                                                    }
                                                    disabled={isBusy}
                                                    onChange={(e) =>
                                                      updateChecklistDraft(
                                                        row.id,
                                                        "isFlexReceived",
                                                        e.target.checked,
                                                      )
                                                    }
                                                  />
                                                  Flex Received
                                                </label>
                                                <label
                                                  style={{
                                                    fontSize: 12,
                                                    color:
                                                      "var(--text-primary)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                  }}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={
                                                      checklist.isReadyForInstall
                                                    }
                                                    disabled={isBusy}
                                                    onChange={(e) =>
                                                      updateChecklistDraft(
                                                        row.id,
                                                        "isReadyForInstall",
                                                        e.target.checked,
                                                      )
                                                    }
                                                  />
                                                  Ready For Install
                                                </label>
                                              </div>

                                              <div
                                                style={{
                                                  display: "flex",
                                                  gap: 6,
                                                  flexWrap: "wrap",
                                                  alignItems: "center",
                                                }}
                                              >
                                                <button
                                                  className="btn btn-secondary"
                                                  style={{
                                                    fontSize: 11,
                                                    padding: "4px 8px",
                                                  }}
                                                  disabled={isBusy}
                                                  onClick={() =>
                                                    saveChecklist(row)
                                                  }
                                                >
                                                  Save Checklist
                                                </button>

                                                <label
                                                  className="btn btn-secondary"
                                                  style={{
                                                    fontSize: 11,
                                                    padding: "4px 8px",
                                                    cursor: "pointer",
                                                  }}
                                                >
                                                  Upload Site Image
                                                  <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    disabled={isBusy}
                                                    style={{ display: "none" }}
                                                    onChange={(e) => {
                                                      uploadExecutionImages(
                                                        row.id,
                                                        "mount",
                                                        e.target.files,
                                                      );
                                                      e.currentTarget.value =
                                                        "";
                                                    }}
                                                  />
                                                </label>

                                                <select
                                                  value={String(
                                                    row.executionStatus ||
                                                      "pending",
                                                  )}
                                                  onChange={(e) =>
                                                    updateExecutionStatus(
                                                      row.id,
                                                      e.target.value,
                                                    )
                                                  }
                                                  disabled={isBusy}
                                                  style={{
                                                    fontSize: 12,
                                                    padding: "4px 6px",
                                                  }}
                                                >
                                                  <option value="pending">
                                                    Pending
                                                  </option>
                                                  <option value="received">
                                                    Received
                                                  </option>
                                                </select>
                                              </div>

                                              <span
                                                style={{
                                                  fontSize: 11,
                                                  color: canMarkLive
                                                    ? "var(--success-color)"
                                                    : "var(--warning-color)",
                                                }}
                                              >
                                                {hasChecklistDraft &&
                                                canMarkLive
                                                  ? "Checklist changes will be auto-saved when you mark live."
                                                  : canMarkLive
                                                    ? "Checklist complete. You can mark this hoarding live."
                                                    : "Complete all checklist items and upload site image before marking live."}
                                              </span>
                                            </div>

                                            <button
                                              className="btn btn-primary"
                                              style={{
                                                fontSize: 11,
                                                padding: "4px 10px",
                                              }}
                                              disabled={isBusy || !canMarkLive}
                                              onClick={async () => {
                                                if (!checklistReady) {
                                                  showError(
                                                    "Complete checklist and upload site image before marking live.",
                                                  );
                                                  return;
                                                }
                                                if (hasChecklistDraft) {
                                                  const ok =
                                                    await persistChecklist(
                                                      row,
                                                      true,
                                                    );
                                                  if (!ok) return;
                                                }
                                                await updateExecutionStatus(
                                                  row.id,
                                                  "live",
                                                );
                                              }}
                                            >
                                              Mark Live
                                            </button>
                                          </>
                                        ) : null}

                                        {activeTab === "live" ? (
                                          <>
                                            <label
                                              className="btn btn-secondary"
                                              style={{
                                                fontSize: 11,
                                                padding: "4px 8px",
                                                cursor: "pointer",
                                              }}
                                            >
                                              Upload
                                              <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                disabled={isBusy}
                                                style={{ display: "none" }}
                                                onChange={(e) => {
                                                  uploadExecutionImages(
                                                    row.id,
                                                    "mount",
                                                    e.target.files,
                                                  );
                                                  e.currentTarget.value = "";
                                                }}
                                              />
                                            </label>
                                            <button
                                              className="btn btn-secondary"
                                              style={{
                                                fontSize: 11,
                                                padding: "4px 10px",
                                              }}
                                              disabled={isBusy}
                                              onClick={() =>
                                                updateExecutionStatus(
                                                  row.id,
                                                  "remount_pending",
                                                )
                                              }
                                            >
                                              Mark Remount Pending
                                            </button>
                                          </>
                                        ) : null}

                                        {activeTab === "remounting" ? (
                                          <>
                                            <label
                                              className="btn btn-secondary"
                                              style={{
                                                fontSize: 11,
                                                padding: "4px 8px",
                                                cursor: "pointer",
                                              }}
                                            >
                                              Upload
                                              <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                disabled={isBusy}
                                                style={{ display: "none" }}
                                                onChange={(e) => {
                                                  uploadExecutionImages(
                                                    row.id,
                                                    "remount",
                                                    e.target.files,
                                                  );
                                                  e.currentTarget.value = "";
                                                }}
                                              />
                                            </label>
                                            <button
                                              className="btn btn-primary"
                                              style={{
                                                fontSize: 11,
                                                padding: "4px 10px",
                                              }}
                                              disabled={isBusy}
                                              onClick={() =>
                                                updateExecutionStatus(
                                                  row.id,
                                                  "remounted",
                                                )
                                              }
                                            >
                                              Mark Remounted
                                            </button>
                                          </>
                                        ) : null}

                                        {activeTab === "unmounting" ? (
                                          <>
                                            <label
                                              className="btn btn-secondary"
                                              style={{
                                                fontSize: 11,
                                                padding: "4px 8px",
                                                cursor: "pointer",
                                              }}
                                            >
                                              Upload
                                              <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                disabled={isBusy}
                                                style={{ display: "none" }}
                                                onChange={(e) => {
                                                  uploadExecutionImages(
                                                    row.id,
                                                    "unmount",
                                                    e.target.files,
                                                  );
                                                  e.currentTarget.value = "";
                                                }}
                                              />
                                            </label>
                                            <button
                                              className="btn btn-primary"
                                              style={{
                                                fontSize: 11,
                                                padding: "4px 10px",
                                              }}
                                              disabled={isBusy}
                                              onClick={() =>
                                                updateExecutionStatus(
                                                  row.id,
                                                  "unmounted",
                                                )
                                              }
                                            >
                                              Mark Unmounted
                                            </button>
                                          </>
                                        ) : null}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                                {/* Image expansion row */}
                                {isExpanded && allImages.length > 0 && (
                                  <tr key={`${row.id}-images`}>
                                    <td
                                      colSpan={9}
                                      style={{
                                        padding: "12px 16px",
                                        background: "#f8fafc",
                                      }}
                                    >
                                      <div
                                        style={{
                                          marginBottom: 6,
                                          fontSize: 13,
                                          fontWeight: 600,
                                        }}
                                      >
                                        Execution Images
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 12,
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        {allImages.map((img, idx) => (
                                          <div
                                            key={idx}
                                            style={{
                                              border: "1px solid #e2e8f0",
                                              borderRadius: 8,
                                              padding: 6,
                                              background: "white",
                                              textAlign: "center",
                                              maxWidth: 160,
                                            }}
                                          >
                                            <a
                                              href={img.image_url || "#"}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              <img
                                                src={img.image_url || ""}
                                                alt={`${img.type || "image"} ${idx + 1}`}
                                                style={{
                                                  width: 140,
                                                  height: 100,
                                                  objectFit: "cover",
                                                  borderRadius: 4,
                                                }}
                                                onError={(e) => {
                                                  (
                                                    e.target as HTMLImageElement
                                                  ).style.display = "none";
                                                }}
                                              />
                                            </a>
                                            <div
                                              style={{
                                                fontSize: 11,
                                                color: "#64748b",
                                                marginTop: 4,
                                              }}
                                            >
                                              <span
                                                style={{
                                                  background:
                                                    img.type === "mount"
                                                      ? "#dcfce7"
                                                      : img.type === "remount"
                                                        ? "#e0f2fe"
                                                        : img.type === "unmount"
                                                          ? "#fef3c7"
                                                          : "#f1f5f9",
                                                  padding: "1px 6px",
                                                  borderRadius: 4,
                                                  fontWeight: 600,
                                                  textTransform: "capitalize",
                                                }}
                                              >
                                                {img.type || "site"}
                                              </span>
                                              {img.timestamp && (
                                                <div style={{ marginTop: 2 }}>
                                                  {formatDate(img.timestamp)}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <div>
                Page {page} / {Math.max(1, Math.ceil(total / limit))} ({total}{" "}
                rows)
              </div>
              <button
                className="btn btn-secondary"
                disabled={page >= Math.ceil(total / limit)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
