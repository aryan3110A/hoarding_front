"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import CustomSelect from "@/components/CustomSelect";
import { bookingTokensAPI, hoardingsAPI, proposalsAPI } from "@/lib/api";
import { showSuccess, showError } from "@/lib/toast";
import {
  canCreate,
  canUpdate,
  canDelete,
  getRoleFromUser,
  canViewRent,
} from "@/lib/rbac";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Hoardings() {
  const router = useRouter();
  const [hoardings, setHoardings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const userFromContext = useUser();
  const [user, setUser] = useState<any>(null);
  const [filters, setFilters] = useState({ city: "", area: "", status: "" });
  const [landlordSearch, setLandlordSearch] = useState("");
  const [landlordFilters, setLandlordFilters] = useState<
    Map<string, { city: string; area: string; status: string }>
  >(new Map());
  const [expandedLandlords, setExpandedLandlords] = useState<Set<string>>(
    new Set(),
  );
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [tokenizingIds, setTokenizingIds] = useState<Set<string>>(new Set());
  const [finalizingIds, setFinalizingIds] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 50;

  // Safely extract role from user object (declare early for effects below)
  const userRole = getRoleFromUser(user);
  const canCreateHoarding = canCreate(userRole, "hoardings");
  const canEditHoarding = canUpdate(userRole, "hoardings");
  const canDeleteHoarding = canDelete(userRole, "hoardings");
  const isSalesRole = (userRole || "").toLowerCase() === "sales";

  useEffect(() => {
    if (userFromContext) {
      setUser(userFromContext);
      return;
    }
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (_) {}
    }
  }, [userFromContext]);

  useEffect(() => {
    if (userFromContext && userFromContext !== user) {
      console.log("📋 [Hoardings Page] User updated from context");
      setUser(userFromContext);
    }
  }, [userFromContext, user]);

  useEffect(() => {
    // Reset when filters change
    const loadInitial = async () => {
      setPage(1);
      setHasMore(true);
      setLoading(true);

      try {
        await fetchHoardings(1, true);
      } catch (error) {
        console.error("Failed to fetch hoardings:", error);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the API call
    const timer = setTimeout(() => {
      loadInitial();
    }, 500);

    return () => clearTimeout(timer);
  }, [filters]);

  // Lightweight polling in Sales view to keep statuses fresh
  useEffect(() => {
    if (!isSalesRole) return;
    // SSE: listen for backend push updates, patch only volatile fields
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:3001";
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    const url = `${apiBase}/api/events/hoarding-status${query}`;
    const source = new EventSource(url as any);
    source.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data || "{}") as {
          hoardingId?: string;
          status?: string;
          hasActiveToken?: boolean;
          propertyRent?: unknown;
        };
        if (!payload?.hoardingId) return;
        setHoardings((prev) =>
          (prev || []).map((h: any) =>
            String(h.id) === String(payload.hoardingId)
              ? {
                  ...h,
                  status:
                    typeof payload.status !== "undefined"
                      ? payload.status
                      : h.status,
                  hasActiveToken:
                    typeof payload.hasActiveToken !== "undefined"
                      ? payload.hasActiveToken
                      : h.hasActiveToken,
                  propertyRent:
                    typeof payload.propertyRent !== "undefined"
                      ? payload.propertyRent
                      : h.propertyRent,
                }
              : h,
          ),
        );
      } catch (_) {}
    };
    source.onerror = () => {
      // silently ignore errors; browser will attempt reconnect
    };
    return () => {
      try {
        source.close();
      } catch (_) {}
    };
  }, [isSalesRole]);

  const fetchHoardings = async (
    pageNum: number = page,
    reset: boolean = false,
  ) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await hoardingsAPI.getAll({
        ...filters,
        page: pageNum,
        limit: PAGE_SIZE,
      });

      if (response.success && response.data) {
        const newHoardings = response.data.hoardings || [];
        const totalCount = response.data.total || 0;

        setTotal(totalCount);
        setHoardings((prev) => {
          const merged = reset
            ? newHoardings
            : [...(prev || []), ...newHoardings];
          setHasMore(totalCount > merged.length);
          return merged;
        });
      }
    } catch (error) {
      console.error("Failed to fetch hoardings:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchHoardings(nextPage, false);
  };

  const deleteGroup = async (group: any) => {
    if (!canDeleteHoarding) return;
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this property and all its hoardings?",
    );
    if (!confirmDelete) return;

    try {
      setDeletingKey(group.uniqueKey);
      // Delete all hoardings in this grouped property
      const ids: string[] = (group.hoardings || []).map((h: any) =>
        String(h.id),
      );
      for (const id of ids) {
        try {
          await hoardingsAPI.delete(id);
        } catch (err) {
          console.error(`Failed to delete hoarding ${id}:`, err);
        }
      }

      // Refresh current page
      await fetchHoardings(1, true);
      showSuccess("Property deleted successfully.");
    } catch (error) {
      console.error("Failed to delete property group:", error);
      showError("Failed to delete property. Please try again.");
    } finally {
      setDeletingKey(null);
    }
  };

  const tokenizeInline = async (hoardingId: string) => {
    // New flow: open tokenization form page to collect client + duration.
    const id = String(hoardingId);
    if (!id) return;
    router.push(`/hoardings/${id}/token`);
  };

  const finalizeFromDraft = async (proposalId: string, hoardingId: string) => {
    const pid = String(proposalId || "");
    const hid = String(hoardingId || "");
    if (!pid || !hid) return;
    if (!confirm("Finalize this hoarding now?")) return;
    setFinalizingIds((prev) => new Set(prev).add(hid));
    try {
      const resp = await proposalsAPI.finalize(pid, { hoardingIds: [hid] });
      if (resp?.success) {
        showSuccess("Hoarding finalized");
        await fetchHoardings(1, true);
      } else {
        showError(resp?.message || "Failed to finalize");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to finalize");
    } finally {
      setFinalizingIds((prev) => {
        const next = new Set(prev);
        next.delete(hid);
        return next;
      });
    }
  };

  const formatRemaining = (expiresAt: any) => {
    if (!expiresAt) return null;
    const exp = new Date(expiresAt);
    if (isNaN(exp.getTime())) return null;
    const ms = exp.getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  return (
    <ProtectedRoute component="hoardings">
      <div>
        {(() => {
          // Compute display total: when filtering by On Rent, show number of unique properties
          // rather than raw hoarding count. Prefer unique propertyGroupId; fallback to grouping key.
          const isOnRent = (filters.status || "").toLowerCase() === "on_rent";
          const isSalesView = isSalesRole;
          let totalDisplay = total;
          if (isOnRent && hoardings && hoardings.length) {
            const unique = new Set<string>();
            for (const h of hoardings) {
              if (h.propertyGroupId) {
                unique.add(String(h.propertyGroupId));
                continue;
              }
              const code: string = h.code || "";
              const parts = code.split("-");
              let prefix = code;
              if (parts.length >= 2) prefix = parts.slice(0, 2).join("-");
              const locationKey = h.landmark || h.title || h.location || "";
              const sideKey = h.side || "";
              unique.add(`${prefix}|${locationKey}|${sideKey}`);
            }
            totalDisplay = unique.size;
          }
          // For sales view on rent, total should reflect individual hoardings in rented properties
          if (isSalesView && hoardings && hoardings.length) {
            totalDisplay = hoardings.filter((h) => {
              // Consider hoardings belonging to a propertyGroupId that has rent attached
              // or the hoarding itself marked on_rent
              const status = (h.status || "").toLowerCase();
              const hasGroupRent = !!h.propertyRent || !!h.propertyGroupId; // backend attaches propertyRent on items in rented groups
              return status === "on_rent" || hasGroupRent;
            }).length;
          }
          // Render header with dynamic total count
          return (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h1>Hoardings Master</h1>
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
                  {isSalesView
                    ? `Total: ${isOnRent ? totalDisplay : total} hoardings`
                    : (filters.status || "").toLowerCase() === "on_rent"
                      ? `Total: ${totalDisplay} properties on rent`
                      : `Total: ${total} hoardings`}
                </p>
              </div>
              {canCreateHoarding && (
                <Link href="/hoardings/new" className="btn btn-primary">
                  Add New Hoarding
                </Link>
              )}
            </div>
          );
        })()}

        {isSalesRole ? (
          <div className="card">
            <h3>Filters</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "12px",
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: "block", marginBottom: "6px" }}>
                  City
                </label>
                <input
                  type="text"
                  value={filters.city}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, city: e.target.value }))
                  }
                  placeholder="Enter city"
                  style={{ width: "100%" }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: "block", marginBottom: "6px" }}>
                  Area
                </label>
                <input
                  type="text"
                  value={filters.area}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, area: e.target.value }))
                  }
                  placeholder="Enter area"
                  style={{ width: "100%" }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: "block", marginBottom: "6px" }}>
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, status: e.target.value }))
                  }
                  style={{ width: "100%" }}
                >
                  <option value="">All</option>
                  <option value="available">Available</option>
                  <option value="tokenized">Tokenized</option>
                  <option value="under_process">Under Processing</option>
                  <option value="booked">Booked</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <h3>Search by Landlord Name</h3>
            <div className="form-group">
              <input
                type="text"
                value={landlordSearch}
                onChange={(e) => setLandlordSearch(e.target.value)}
                placeholder="Type landlord name to search..."
                style={{ width: "100%" }}
              />
            </div>
          </div>
        )}

        <div className="card">
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div
                className="loading-spinner"
                style={{ margin: "0 auto" }}
              ></div>
              <p>Loading hoardings...</p>
            </div>
          ) : (
            (() => {
              // Sales view: always list individual hoardings with status filter
              if (isSalesRole) {
                const toFt = (w?: number, h?: number) => {
                  if (!w || !h) return "—";
                  return `${Math.round(w / 30.48)}ft x ${Math.round(
                    h / 30.48,
                  )}ft`;
                };
                const statusFilter = (filters.status || "").toLowerCase();
                const list = hoardings;
                const filtered = (() => {
                  if (!statusFilter) return list;
                  if (statusFilter === "tokenized") {
                    // Use backend-computed flag to avoid confusion
                    return list.filter((h: any) => h.hasActiveToken === true);
                  }
                  return list.filter(
                    (h: any) => (h.status || "").toLowerCase() === statusFilter,
                  );
                })();
                if (!filtered.length) {
                  return (
                    <div style={{ textAlign: "center", padding: "40px" }}>
                      No hoardings found
                    </div>
                  );
                }
                return (
                  <table className="table">
                    <thead>
                      <tr>
                        {/* Hide Hoarding ID for Sales */}
                        {!isSalesRole && <th>Hoarding ID</th>}
                        <th>Code</th>
                        <th>City</th>
                        <th>Area</th>
                        <th>Location</th>
                        <th>Size</th>
                        <th>Status</th>
                        <th>Ownership</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((h: any) => {
                        const rawStatus = (h.status || "").toLowerCase();
                        const tokens = Array.isArray(h.tokens) ? h.tokens : [];
                        const activeToken =
                          tokens.find((t: any) =>
                            [
                              "BLOCKED",
                              "EXTENSION_REQUESTED",
                              "ACTIVE",
                            ].includes(String(t?.status || "").toUpperCase()),
                          ) || null;
                        const remaining = activeToken
                          ? formatRemaining(activeToken.expiresAt)
                          : null;
                        const activeTokenStatus = String(
                          activeToken?.status || "",
                        ).toUpperCase();
                        const displayStatus =
                          h.hasActiveToken === true || rawStatus === "tokenized"
                            ? "tokenized"
                            : rawStatus === "under_process"
                              ? "Under Process"
                              : rawStatus === "available"
                                ? "Hoarding Available"
                                : rawStatus === "booked"
                                  ? "Booked"
                                  : rawStatus === "occupied"
                                    ? "Occupied"
                                    : rawStatus === "on_rent"
                                      ? "Hoarding On Rent"
                                      : h.status || "—";

                        return (
                          <tr key={h.id}>
                            {!isSalesRole && <td>{h.id}</td>}
                            <td>
                              {h.code} {h.side ? `(${h.side})` : ""}
                            </td>
                            <td>{h.city || "—"}</td>
                            <td>{h.area || "—"}</td>
                            <td>
                              {h.landmark || h.location || h.title || "—"}
                            </td>
                            <td>{toFt(h.widthCm, h.heightCm)}</td>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 4,
                                }}
                              >
                                <div>{displayStatus}</div>
                                {h.hasActiveToken === true && remaining ? (
                                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                                    {activeTokenStatus === "EXTENSION_REQUESTED"
                                      ? "Extension requested"
                                      : "Block expires"}
                                    : {remaining}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td>{h.ownership || "—"}</td>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "8px",
                                  alignItems: "stretch",
                                }}
                              >
                                <Link
                                  href={`/hoardings/${h.id}`}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: "6px 10px",
                                    fontSize: "12px",
                                    width: "100%",
                                  }}
                                >
                                  Info
                                </Link>
                                {(() => {
                                  const myTokenId = h.myActiveTokenId
                                    ? String(h.myActiveTokenId)
                                    : "";
                                  const activeTokenId = activeToken?.id
                                    ? String(activeToken.id)
                                    : "";
                                  const linkTokenId = isSalesRole
                                    ? myTokenId
                                    : activeTokenId;
                                  if (!linkTokenId) return null;
                                  return (
                                    <Link
                                      href={`/booking-tokens/${linkTokenId}`}
                                      className="btn btn-secondary"
                                      style={{
                                        padding: "6px 10px",
                                        fontSize: "12px",
                                        width: "100%",
                                      }}
                                    >
                                      View Token
                                    </Link>
                                  );
                                })()}
                                {(() => {
                                  const id = String(h.id);
                                  const draftProposalId = h.myDraftProposalId
                                    ? String(h.myDraftProposalId)
                                    : "";
                                  const isFinalizing = finalizingIds.has(id);
                                  const isUnderProcess =
                                    String(rawStatus || "")
                                      .toLowerCase()
                                      .trim() === "under_process";
                                  const isBooked =
                                    String(rawStatus || "")
                                      .toLowerCase()
                                      .trim() === "booked";
                                  const isLive =
                                    String(rawStatus || "")
                                      .toLowerCase()
                                      .trim() === "live";
                                  const canFinalizeDraft =
                                    isSalesRole &&
                                    !!draftProposalId &&
                                    !isUnderProcess &&
                                    !isBooked &&
                                    !isLive;
                                  if (!canFinalizeDraft) return null;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        finalizeFromDraft(draftProposalId, id)
                                      }
                                      disabled={isFinalizing}
                                      className="btn btn-success"
                                      style={{
                                        padding: "6px 10px",
                                        fontSize: "12px",
                                        width: "100%",
                                        opacity: isFinalizing ? 0.7 : 1,
                                        cursor: isFinalizing
                                          ? "not-allowed"
                                          : "pointer",
                                      }}
                                    >
                                      {isFinalizing
                                        ? "Finalizing..."
                                        : "Finalize"}
                                    </button>
                                  );
                                })()}
                                {(() => {
                                  const id = String(h.id);
                                  const isTokenizing = tokenizingIds.has(id);
                                  const isMyTokenized = !!h.myActiveToken;
                                  const isUnderProcess =
                                    String(rawStatus || "")
                                      .toLowerCase()
                                      .trim() === "under_process";
                                  const isBooked =
                                    String(rawStatus || "")
                                      .toLowerCase()
                                      .trim() === "booked";
                                  const isLive =
                                    String(rawStatus || "")
                                      .toLowerCase()
                                      .trim() === "live";
                                  const isOccupied =
                                    String(rawStatus || "")
                                      .toLowerCase()
                                      .trim() === "occupied";

                                  const isEligibleStatus =
                                    String(rawStatus || "")
                                      .toLowerCase()
                                      .trim() === "available" ||
                                    String(rawStatus || "")
                                      .toLowerCase()
                                      .trim() === "tokenized";

                                  const isSearchActive = Boolean(
                                    (filters.city && filters.city.trim()) ||
                                    (filters.area && filters.area.trim()) ||
                                    (filters.status && filters.status.trim()) ||
                                    (landlordSearch && landlordSearch.trim()),
                                  );

                                  const isDisabled =
                                    isTokenizing ||
                                    isMyTokenized ||
                                    isUnderProcess ||
                                    isBooked ||
                                    isLive ||
                                    isOccupied ||
                                    !isEligibleStatus ||
                                    // Prevent Sales users from blocking hoardings via ad-hoc search results
                                    (isSalesRole && isSearchActive);
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => tokenizeInline(id)}
                                      disabled={isDisabled}
                                      className="btn btn-primary"
                                      style={{
                                        padding: "6px 10px",
                                        fontSize: "12px",
                                        width: "100%",
                                        opacity: isDisabled ? 0.7 : 1,
                                        cursor: isDisabled
                                          ? "not-allowed"
                                          : "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "6px",
                                      }}
                                    >
                                      {isTokenizing && (
                                        <span
                                          className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"
                                          aria-hidden="true"
                                        />
                                      )}
                                      {isMyTokenized
                                        ? "Tokenized"
                                        : isBooked
                                          ? "Booked"
                                          : "Block Hoarding"}
                                    </button>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              }

              // Helper to format size from cm -> ft string
              const toFt = (w?: number, h?: number) => {
                if (!w || !h) return "—";
                return `${Math.round(w / 30.48)}ft x ${Math.round(
                  h / 30.48,
                )}ft`;
              };

              // Group hoardings directly by landlord ONLY - no property grouping
              const landlordGroups = new Map<string, any[]>();

              // Helper to extract landlord from hoarding
              const getLandlord = (h: any): string => {
                // Try to get landlord from rateHistory JSON field
                if (h.rateHistory && typeof h.rateHistory === "object") {
                  const landlord = (h.rateHistory as any)?.landlord;
                  if (
                    landlord &&
                    typeof landlord === "string" &&
                    landlord.trim()
                  ) {
                    return landlord.trim();
                  }
                }
                // Fallback: try to derive from ownership if available
                if (h.ownership) {
                  const ownership = h.ownership.toString();
                  // Extract landlord from patterns like "GOV - R & B Mehsana" => "R & B Mehsana"
                  const match = ownership.match(
                    /^(gov|govt|government)\s*-\s*(.+)$/i,
                  );
                  if (match && match[2]) {
                    return match[2].trim();
                  }
                }
                return "Unknown";
              };

              // Process each hoarding individually - pure landlord grouping
              for (const h of hoardings) {
                const landlord = getLandlord(h);
                if (!landlordGroups.has(landlord)) {
                  landlordGroups.set(landlord, []);
                }

                // Store hoarding directly - no property grouping logic
                landlordGroups.get(landlord)!.push(h);
              }

              // Filter landlords by search term
              const filteredLandlordGroups = Array.from(
                landlordGroups.entries(),
              )
                .filter(([landlord]) => {
                  if (!landlordSearch.trim()) return true;
                  return landlord
                    .toLowerCase()
                    .includes(landlordSearch.toLowerCase().trim());
                })
                .sort(([a], [b]) => a.localeCompare(b));

              const toggleLandlord = (landlord: string) => {
                setExpandedLandlords((prev) => {
                  const newSet = new Set(prev);
                  if (newSet.has(landlord)) {
                    newSet.delete(landlord);
                  } else {
                    newSet.add(landlord);
                  }
                  return newSet;
                });
              };

              const updateLandlordFilter = (
                landlord: string,
                field: "city" | "area" | "status",
                value: string,
              ) => {
                setLandlordFilters((prev) => {
                  const newMap = new Map(prev);
                  const current = newMap.get(landlord) || {
                    city: "",
                    area: "",
                    status: "",
                  };
                  newMap.set(landlord, { ...current, [field]: value });
                  return newMap;
                });
              };

              const getLandlordFilter = (landlord: string) => {
                return (
                  landlordFilters.get(landlord) || {
                    city: "",
                    area: "",
                    status: "",
                  }
                );
              };

              const filterHoardingsForLandlord = (
                hoardings: any[],
                filters: { city: string; area: string; status: string },
              ) => {
                return hoardings.filter((h) => {
                  if (
                    filters.city &&
                    !(h.city || "")
                      .toLowerCase()
                      .includes(filters.city.toLowerCase())
                  ) {
                    return false;
                  }
                  if (
                    filters.area &&
                    !(h.area || "")
                      .toLowerCase()
                      .includes(filters.area.toLowerCase())
                  ) {
                    return false;
                  }
                  if (filters.status) {
                    const status = (h.status || "").toLowerCase();
                    const filterStatus = filters.status.toLowerCase();
                    if (status !== filterStatus) {
                      return false;
                    }
                  }
                  return true;
                });
              };

              const handleLandlordRent = (landlord: string) => {
                if (!canViewRent(userRole)) {
                  showError(
                    "You don't have permission to set hoardings on rent.",
                  );
                  return;
                }

                // Navigate to the bulk rent page for this landlord
                router.push(`/landlords/${encodeURIComponent(landlord)}/rent`);
              };

              const isAllOnRent = (hoardings: any[]): boolean => {
                return hoardings.every(
                  (h) => (h.status || "").toLowerCase() === "on_rent",
                );
              };

              if (filteredLandlordGroups.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    {landlordSearch.trim()
                      ? "No landlords found matching your search"
                      : "No hoardings found"}
                  </div>
                );
              }

              return (
                <div>
                  {filteredLandlordGroups.map(([landlord, hoardingGroups]) => {
                    const isExpanded = expandedLandlords.has(landlord);
                    const landlordFilter = getLandlordFilter(landlord);
                    const filteredHoardings = filterHoardingsForLandlord(
                      hoardingGroups,
                      landlordFilter,
                    );
                    const totalHoardings = hoardingGroups.length;
                    const filteredCount = filteredHoardings.length;
                    const allOnRent = isAllOnRent(hoardingGroups);

                    return (
                      <div
                        key={landlord}
                        style={{
                          marginBottom: "12px",
                          border: "1px solid var(--border-color, #e2e8f0)",
                          borderRadius: "8px",
                          overflow: "hidden",
                        }}
                      >
                        {/* Landlord Header Row */}
                        <div
                          style={{
                            padding: "16px 20px",
                            backgroundColor: isExpanded
                              ? "var(--primary-light, rgba(0, 187, 241, 0.1))"
                              : "var(--bg-secondary, #ffffff)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            transition: "background-color 0.2s ease",
                          }}
                        >
                          <div
                            onClick={() => toggleLandlord(landlord)}
                            style={{
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) => {
                              if (!isExpanded) {
                                e.currentTarget.parentElement!.style.backgroundColor =
                                  "rgba(0, 187, 241, 0.05)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isExpanded) {
                                e.currentTarget.parentElement!.style.backgroundColor =
                                  "var(--bg-secondary, #ffffff)";
                              }
                            }}
                          >
                            <span
                              style={{
                                fontSize: "18px",
                                fontWeight: "600",
                                color: "var(--text-primary)",
                              }}
                            >
                              {landlord}
                            </span>
                            <span
                              style={{
                                fontSize: "14px",
                                color: "var(--text-secondary)",
                                padding: "2px 8px",
                                backgroundColor:
                                  "var(--primary-light, rgba(0, 187, 241, 0.15))",
                                borderRadius: "12px",
                              }}
                            >
                              {isExpanded && filteredCount !== totalHoardings
                                ? `${filteredCount} / ${totalHoardings}`
                                : totalHoardings}{" "}
                              {totalHoardings === 1 ? "hoarding" : "hoardings"}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            {canViewRent(userRole) && (
                              <button
                                className={
                                  allOnRent
                                    ? "btn btn-success"
                                    : "btn btn-primary"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLandlordRent(landlord);
                                }}
                                disabled={allOnRent}
                                style={{
                                  padding: "6px 16px",
                                  fontSize: "13px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {allOnRent ? "On Rent" : "Rent"}
                              </button>
                            )}
                            <span
                              onClick={() => toggleLandlord(landlord)}
                              style={{
                                fontSize: "20px",
                                color: "var(--text-secondary)",
                                transition: "transform 0.2s ease",
                                transform: isExpanded
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                                cursor: "pointer",
                              }}
                            >
                              ▼
                            </span>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: "20px",
                              backgroundColor: "var(--bg-secondary, #ffffff)",
                              borderTop:
                                "1px solid var(--border-color, #e2e8f0)",
                            }}
                          >
                            {/* Filters for this landlord */}
                            <div
                              style={{
                                marginBottom: "20px",
                                padding: "16px",
                                backgroundColor: "var(--bg-primary, #f8f9fa)",
                                borderRadius: "8px",
                              }}
                            >
                              <h4
                                style={{
                                  marginBottom: "12px",
                                  fontSize: "14px",
                                  fontWeight: "600",
                                  color: "var(--text-primary)",
                                }}
                              >
                                Filters
                              </h4>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(3, 1fr)",
                                  gap: "12px",
                                }}
                              >
                                <div
                                  className="form-group"
                                  style={{ margin: 0 }}
                                >
                                  <label
                                    style={{
                                      fontSize: "12px",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    City
                                  </label>
                                  <input
                                    type="text"
                                    value={landlordFilter.city}
                                    onChange={(e) =>
                                      updateLandlordFilter(
                                        landlord,
                                        "city",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Filter by city"
                                    style={{ fontSize: "13px" }}
                                  />
                                </div>
                                <div
                                  className="form-group"
                                  style={{ margin: 0 }}
                                >
                                  <label
                                    style={{
                                      fontSize: "12px",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    Area
                                  </label>
                                  <input
                                    type="text"
                                    value={landlordFilter.area}
                                    onChange={(e) =>
                                      updateLandlordFilter(
                                        landlord,
                                        "area",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Filter by area"
                                    style={{ fontSize: "13px" }}
                                  />
                                </div>
                                <div
                                  className="form-group"
                                  style={{ margin: 0 }}
                                >
                                  <label
                                    style={{
                                      fontSize: "12px",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    Status
                                  </label>
                                  <CustomSelect
                                    value={landlordFilter.status}
                                    onChange={(val) =>
                                      updateLandlordFilter(
                                        landlord,
                                        "status",
                                        val,
                                      )
                                    }
                                    options={[
                                      { value: "", label: "All" },
                                      {
                                        value: "available",
                                        label: "Available",
                                      },
                                      { value: "on_rent", label: "On Rent" },
                                      { value: "occupied", label: "Occupied" },
                                      { value: "booked", label: "Booked" },
                                    ]}
                                  />
                                </div>
                              </div>
                              {filteredCount !== totalHoardings && (
                                <div
                                  style={{
                                    marginTop: "8px",
                                    fontSize: "12px",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  Showing {filteredCount} of {totalHoardings}{" "}
                                  hoardings
                                </div>
                              )}
                            </div>

                            {filteredHoardings.length === 0 ? (
                              <div
                                style={{
                                  textAlign: "center",
                                  padding: "20px",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                No hoardings match the filters
                              </div>
                            ) : (
                              <table className="table" style={{ margin: 0 }}>
                                <thead>
                                  <tr>
                                    <th>Property / Location</th>
                                    <th>Hoarding Code</th>
                                    <th>Size</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredHoardings.map(
                                    (h: any, idx: number) => {
                                      return (
                                        <tr key={`${h.id}-${idx}`}>
                                          <td>
                                            <strong>{h.city || "—"}</strong>
                                            <div
                                              style={{
                                                fontSize: "12px",
                                                color: "var(--text-secondary)",
                                                marginTop: "4px",
                                              }}
                                            >
                                              {[
                                                h.area,
                                                h.landmark || h.location || "",
                                              ]
                                                .filter(Boolean)
                                                .join(", ")}
                                            </div>
                                          </td>
                                          <td>
                                            {h.code}{" "}
                                            {h.side ? `(${h.side})` : ""}
                                          </td>
                                          <td>{toFt(h.widthCm, h.heightCm)}</td>
                                          <td>
                                            {(h.status || "").toLowerCase() ===
                                            "available"
                                              ? "Available"
                                              : (
                                                    h.status || ""
                                                  ).toLowerCase() === "on_rent"
                                                ? "On Rent"
                                                : (
                                                      h.status || ""
                                                    ).toLowerCase() ===
                                                    "occupied"
                                                  ? "Occupied"
                                                  : (
                                                        h.status || ""
                                                      ).toLowerCase() ===
                                                      "booked"
                                                    ? "Booked"
                                                    : h.status || "—"}
                                          </td>
                                          <td>
                                            <div
                                              style={{
                                                display: "flex",
                                                gap: "8px",
                                                flexWrap: "nowrap",
                                                alignItems: "center",
                                              }}
                                            >
                                              {canViewRent(userRole) && <></>}
                                              {canEditHoarding && (
                                                <Link
                                                  href={`/hoardings/${h.id}/edit`}
                                                  className="btn btn-warning"
                                                  style={{
                                                    padding: "5px 10px",
                                                    fontSize: "12px",
                                                  }}
                                                >
                                                  Edit
                                                </Link>
                                              )}
                                              {canDeleteHoarding && (
                                                <button
                                                  className="btn btn-danger"
                                                  style={{
                                                    padding: "5px 10px",
                                                    fontSize: "12px",
                                                  }}
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!canDeleteHoarding)
                                                      return;
                                                    const confirmDelete =
                                                      window.confirm(
                                                        "Are you sure you want to delete this hoarding?",
                                                      );
                                                    if (!confirmDelete) return;

                                                    try {
                                                      await hoardingsAPI.delete(
                                                        h.id,
                                                      );
                                                      await fetchHoardings(
                                                        1,
                                                        true,
                                                      );
                                                      showSuccess(
                                                        "Hoarding deleted successfully.",
                                                      );
                                                    } catch (error) {
                                                      console.error(
                                                        "Failed to delete hoarding:",
                                                        error,
                                                      );
                                                      showError(
                                                        "Failed to delete hoarding. Please try again.",
                                                      );
                                                    }
                                                  }}
                                                >
                                                  Delete
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    },
                                  )}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}

          {!loading && hasMore && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <button
                className="btn btn-secondary"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
