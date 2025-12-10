"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/components/AppLayout";
import CustomSelect from "@/components/CustomSelect";
import { hoardingsAPI } from "@/lib/api";
import { bookingTokensAPI } from "@/lib/api";
import { showSuccess, showError } from "@/lib/toast";
import {
  canCreate,
  canUpdate,
  canDelete,
  canAccess,
  getRoleFromUser,
  canViewRent,
} from "@/lib/rbac";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Hoardings() {
  const [hoardings, setHoardings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const userFromContext = useUser();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [filters, setFilters] = useState({ city: "", area: "", status: "" });
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const limit = 100;

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

  // Update user when context user becomes available
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
        const response = await hoardingsAPI.getAll({
          ...filters,
          page: 1,
          limit: limit,
        });

        if (response.success && response.data) {
          const newHoardings = response.data.hoardings || [];
          const totalCount = response.data.total || 0;
          setHoardings(newHoardings);
          setTotal(totalCount);
          setHasMore(newHoardings.length < totalCount);
        }
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

  const fetchHoardings = async (
    pageNum: number = page,
    reset: boolean = false
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
        limit: limit,
      });

      if (response.success && response.data) {
        const newHoardings = response.data.hoardings || [];
        const totalCount = response.data.total || 0;

        if (reset) {
          setHoardings(newHoardings);
          setHasMore(newHoardings.length < totalCount);
        } else {
          setHoardings((prev) => {
            const updated = [...prev, ...newHoardings];
            setHasMore(updated.length < totalCount);
            return updated;
          });
        }

        setTotal(totalCount);
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

  // Safely extract role from user object
  const userRole = getRoleFromUser(user);

  const canCreateHoarding = canCreate(userRole, "hoardings");
  const canEditHoarding = canUpdate(userRole, "hoardings");
  const canDeleteHoarding = canDelete(userRole, "hoardings");
  const isSalesRole = (userRole || "").toLowerCase() === "sales";

  const deleteGroup = async (group: any) => {
    if (!canDeleteHoarding) return;
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this property and all its hoardings?"
    );
    if (!confirmDelete) return;

    try {
      setDeletingKey(group.uniqueKey);
      // Delete all hoardings in this grouped property
      const ids: string[] = (group.hoardings || []).map((h: any) =>
        String(h.id)
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

  // Per-hoarding selected date range for Sales tokenization
  const [bookingDatesById, setBookingDatesById] = useState<
    Record<string, { from: string; to: string }>
  >({});
  const createToken = async (hoardingId: string) => {
    try {
      const current = bookingDatesById[hoardingId] || { from: "", to: "" };
      if (!current.from || !current.to) {
        showError("Select date range first");
        return;
      }
      const resp = await bookingTokensAPI.create({
        hoardingId,
        dateFrom: current.from,
        dateTo: current.to,
      });
      if (resp.success) {
        const pos = resp.data.queuePosition || 1;
        showSuccess(`Token created. You are #${pos} in queue.`);
        // Persist the selected dates in UI for this hoarding row
        setBookingDatesById((prev) => ({
          ...prev,
          [hoardingId]: { ...current },
        }));
      } else {
        showError(resp.message || "Failed to create token");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to create token");
    }
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

        <div className="card">
          <h3>Filters</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "10px",
            }}
          >
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                value={filters.city}
                onChange={(e) =>
                  setFilters({ ...filters, city: e.target.value })
                }
                placeholder="Filter by city"
              />
            </div>
            <div className="form-group">
              <label>Area</label>
              <input
                type="text"
                value={filters.area}
                onChange={(e) =>
                  setFilters({ ...filters, area: e.target.value })
                }
                placeholder="Filter by area"
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <CustomSelect
                value={filters.status}
                onChange={(val) => setFilters({ ...filters, status: val })}
                options={(() => {
                  if (isSalesRole) {
                    return [
                      { value: "", label: "All" },
                      { value: "available", label: "Available" },
                      { value: "booked", label: "Booked" },
                      { value: "tokenized", label: "Book (Tokenized)" },
                    ];
                  }
                  return [
                    { value: "", label: "All" },
                    { value: "available", label: "Available" },
                    { value: "on_rent", label: "On Rent" },
                    { value: "occupied", label: "Occupied" },
                    { value: "booked", label: "Booked" },
                  ];
                })()}
              />
            </div>
          </div>
        </div>

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
              // Group hoardings by propertyGroupId when available.
              // Fallback to code prefix (first two segments) + landmark/location.
              const groupsMap: Record<string, any> = {};
              for (const h of hoardings) {
                // Prefer explicit backend grouping id to ensure all faces/directions
                // of the same property are counted as one.
                const groupId: string | null = h.propertyGroupId
                  ? String(h.propertyGroupId)
                  : null;

                // IMPORTANT: Split properties by facing direction/roadName even if
                // they share the same propertyGroupId. This ensures Solo vs LHS/RHS
                // on opposite directions are treated as separate properties.
                const directionKey = (h.roadName || "")
                  .toString()
                  .trim()
                  .toLowerCase();

                let key = groupId || "";
                let linkKey = groupId || ""; // keep rent link pointing to group id

                if (!key) {
                  const code = h.code || "";
                  const parts = code.split("-");
                  let prefix = code;
                  if (parts.length >= 2) {
                    prefix = parts.slice(0, 2).join("-");
                  }

                  // Use landmark/title to distinguish structures within the same prefix group
                  const locationKey = h.landmark || h.title || h.location || "";
                  key = `${prefix}|${locationKey}`;
                  linkKey = prefix;
                }

                // If we have a propertyGroupId, refine unique grouping by direction/road
                // so opposite facing properties are not merged.
                if (groupId) {
                  key = `${groupId}|${directionKey || ""}`;
                }

                if (!groupsMap[key]) {
                  groupsMap[key] = {
                    uniqueKey: key,
                    linkKey: linkKey,
                    // keep original propertyGroupId for display if present
                    propertyGroupId: h.propertyGroupId || null,
                    // Display: City as title; Area and Location/Landmark below
                    title: h.city || "",
                    subtitle: [h.area, h.location || h.landmark || ""]
                      .filter(Boolean)
                      .join(", "),
                    hoardings: [],
                  };
                }
                groupsMap[key].hoardings.push(h);
              }
              const groups = Object.values(groupsMap);
              if (!groups.length) {
                return (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    No hoardings found
                  </div>
                );
              }

              // Sales view: always list individual hoardings with status filter
              if (isSalesRole) {
                const toFt = (w?: number, h?: number) => {
                  if (!w || !h) return "—";
                  return `${Math.round(w / 30.48)}ft x ${Math.round(
                    h / 30.48
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
                    (h: any) => (h.status || "").toLowerCase() === statusFilter
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
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((h: any) => (
                        <tr key={h.id}>
                          {!isSalesRole && <td>{h.id}</td>}
                          <td>
                            {h.code} {h.side ? `(${h.side})` : ""}
                          </td>
                          <td>{h.city || "—"}</td>
                          <td>{h.area || "—"}</td>
                          <td>{h.landmark || h.location || h.title || "—"}</td>
                          <td>{toFt(h.widthCm, h.heightCm)}</td>
                          <td>
                            {(h.status || "").toLowerCase() === "available"
                              ? "Hoarding Available"
                              : (h.status || "").toLowerCase() === "booked"
                              ? "Booked"
                              : (h.status || "").toLowerCase() === "occupied"
                              ? "Occupied"
                              : (h.status || "").toLowerCase() === "on_rent"
                              ? "Hoarding On Rent"
                              : h.status || "—"}
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                gap: "6px",
                                alignItems: "center",
                              }}
                            >
                              <input
                                type="date"
                                value={bookingDatesById[h.id]?.from || ""}
                                onChange={(e) =>
                                  setBookingDatesById((prev) => ({
                                    ...prev,
                                    [h.id]: {
                                      from: e.target.value,
                                      to: prev[h.id]?.to || "",
                                    },
                                  }))
                                }
                                style={{ fontSize: "12px" }}
                              />
                              <input
                                type="date"
                                value={bookingDatesById[h.id]?.to || ""}
                                onChange={(e) =>
                                  setBookingDatesById((prev) => ({
                                    ...prev,
                                    [h.id]: {
                                      from: prev[h.id]?.from || "",
                                      to: e.target.value,
                                    },
                                  }))
                                }
                                style={{ fontSize: "12px" }}
                              />
                              <button
                                className="btn btn-secondary"
                                style={{
                                  padding: "5px 10px",
                                  fontSize: "12px",
                                }}
                                onClick={() => createToken(h.id)}
                              >
                                Book (Token)
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              }
              // Helper to format size from cm -> ft string
              const toFt = (w?: number, h?: number) => {
                if (!w || !h) return "—";
                return `${Math.round(w / 30.48)}ft x ${Math.round(
                  h / 30.48
                )}ft`;
              };
              return (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Property / Location</th>
                      <th>Hoardings</th>
                      <th>Total Faces</th>
                      <th>Sizes</th>
                      <th>Status Summary</th>
                      <th>Ownership</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => {
                      const sizes = Array.from(
                        new Set(
                          g.hoardings.map((h: any) =>
                            toFt(h.widthCm, h.heightCm)
                          )
                        ).values()
                      ).filter((s) => s !== "—");
                      const statusCounts: Record<string, number> = {};
                      const ownerships = new Set<string>();
                      g.hoardings.forEach((h: any) => {
                        statusCounts[h.status] =
                          (statusCounts[h.status] || 0) + 1;
                        if (h.ownership) ownerships.add(h.ownership);
                      });
                      // Consider a property "on rent" only if ALL its faces/entries
                      // in this grouped direction are on rent. This prevents rent state
                      // from leaking to other faces when the backend attaches group rent.
                      const isGroupOnRent =
                        g.hoardings.length > 0 &&
                        g.hoardings.every(
                          (h: any) =>
                            (h.status || "").toLowerCase() === "on_rent"
                        );
                      const statusSummary = isGroupOnRent
                        ? "Property On Rent"
                        : statusCounts["available"]
                        ? "Property Available"
                        : "—";
                      const ownershipDisplay = ownerships.size
                        ? Array.from(ownerships).join(", ")
                        : "—";
                      // landlord column removed per request

                      return (
                        <tr key={g.uniqueKey}>
                          <td>
                            <strong>{g.title}</strong>
                            {g.subtitle && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {g.subtitle}
                              </div>
                            )}
                          </td>
                          {/* Landlord column removed */}
                          <td>
                            {g.hoardings.map((h: any) => (
                              <div key={h.id} style={{ fontSize: "12px" }}>
                                {h.code} {h.side && `(${h.side})`}
                              </div>
                            ))}
                          </td>
                          <td>{g.hoardings.length}</td>
                          <td>{sizes.length ? sizes.join(" | ") : "—"}</td>
                          <td style={{ fontSize: "12px" }}>
                            {statusSummary || "—"}
                          </td>
                          <td>{ownershipDisplay}</td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "nowrap",
                                alignItems: "center",
                                justifyContent: "flex-start",
                              }}
                            >
                              {canViewRent(userRole) && (
                                <Link
                                  href={`/property-rents/${encodeURIComponent(
                                    g.linkKey
                                  )}`}
                                  className="btn btn-primary"
                                  style={{
                                    padding: "5px 10px",
                                    fontSize: "12px",
                                  }}
                                >
                                  Rent
                                </Link>
                              )}
                              {canEditHoarding && (
                                <Link
                                  href={`/hoardings/${g.hoardings[0].id}/edit`}
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
                                    padding: "7.5px 10px",
                                    fontSize: "12px",
                                    opacity:
                                      deletingKey === g.uniqueKey ? 0.7 : 1,
                                  }}
                                  onClick={() => deleteGroup(g)}
                                  disabled={deletingKey === g.uniqueKey}
                                >
                                  {deletingKey === g.uniqueKey
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              )}
                              {isSalesRole && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "6px",
                                    alignItems: "center",
                                  }}
                                >
                                  <input
                                    type="date"
                                    value={
                                      bookingDatesById[g.hoardings[0].id]
                                        ?.from || ""
                                    }
                                    onChange={(e) =>
                                      setBookingDatesById((prev) => ({
                                        ...prev,
                                        [g.hoardings[0].id]: {
                                          from: e.target.value,
                                          to: prev[g.hoardings[0].id]?.to || "",
                                        },
                                      }))
                                    }
                                    style={{ fontSize: "12px" }}
                                  />
                                  <input
                                    type="date"
                                    value={
                                      bookingDatesById[g.hoardings[0].id]?.to ||
                                      ""
                                    }
                                    onChange={(e) =>
                                      setBookingDatesById((prev) => ({
                                        ...prev,
                                        [g.hoardings[0].id]: {
                                          from:
                                            prev[g.hoardings[0].id]?.from || "",
                                          to: e.target.value,
                                        },
                                      }))
                                    }
                                    style={{ fontSize: "12px" }}
                                  />
                                  <button
                                    className="btn btn-secondary"
                                    style={{
                                      padding: "5px 10px",
                                      fontSize: "12px",
                                    }}
                                    onClick={() =>
                                      createToken(g.hoardings[0].id)
                                    }
                                  >
                                    Book (Token)
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
