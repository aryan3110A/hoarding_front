"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/components/AppLayout";
import OptionAutocomplete from "@/components/OptionAutocomplete";
import CustomSelect from "@/components/CustomSelect";
import { categoriesAPI, hoardingsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";
import { canCreate, canDelete, canUpdate, getRoleFromUser } from "@/lib/rbac";
import ProtectedRoute from "@/components/ProtectedRoute";

const PAGE_SIZE = 50;

type HoardingFilters = {
  city: string;
  area: string;
  landmark: string;
  status: string;
  categoryId: string;
  type: string;
};

export default function Hoardings() {
  const [hoardings, setHoardings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const userFromContext = useUser();
  const [user, setUser] = useState<any>(null);

  const [filters, setFilters] = useState<HoardingFilters>({
    city: "",
    area: "",
    landmark: "",
    status: "",
    categoryId: "",
    type: "",
  });

  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [landmarkOptions, setLandmarkOptions] = useState<string[]>([]);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);

  const userRole = getRoleFromUser(user);
  const canCreateHoarding = canCreate(userRole, "hoardings");
  const canEditHoarding = canUpdate(userRole, "hoardings");
  const canDeleteHoarding = canDelete(userRole, "hoardings");
  const canCreateBookingToken = canCreate(userRole, "bookingTokens");
  const isSalesUser = userRole === "sales";

  useEffect(() => {
    if (userFromContext) {
      setUser(userFromContext);
      return;
    }

    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        setUser(null);
      }
    }
  }, [userFromContext]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await categoriesAPI.list();
        setCategories(Array.isArray(res?.data) ? res.data : []);
      } catch {
        setCategories([]);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const loadAutocompleteData = async () => {
      try {
        const [citiesRes, landmarksRes, typesRes] = await Promise.all([
          hoardingsAPI.getCities(),
          hoardingsAPI.getLandmarks(),
          hoardingsAPI.getTypes(),
        ]);
        setCityOptions(
          Array.isArray(citiesRes?.data) ? citiesRes.data.map(String) : [],
        );
        setLandmarkOptions(
          Array.isArray(landmarksRes?.data)
            ? landmarksRes.data.map(String)
            : [],
        );
        setTypeOptions(
          Array.isArray(typesRes?.data) ? typesRes.data.map(String) : [],
        );
      } catch {
        setCityOptions([]);
        setLandmarkOptions([]);
        setTypeOptions([]);
      }
    };

    loadAutocompleteData();
  }, []);

  const fetchHoardings = async (
    pageNum: number = 1,
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

      if (response?.success && response?.data) {
        const rows = Array.isArray(response.data.hoardings)
          ? response.data.hoardings
          : [];
        const totalCount = Number(response.data.total || 0);

        setTotal(totalCount);
        setHoardings((prev) => {
          const merged = reset ? rows : [...prev, ...rows];
          setHasMore(totalCount > merged.length);
          return merged;
        });
      }
    } catch (error) {
      showError("Failed to load hoardings");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      setPage(1);
      setHasMore(true);
      await fetchHoardings(1, true);
    }, 300);

    return () => clearTimeout(timer);
  }, [filters]);

  const loadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchHoardings(nextPage, false);
  };

  const handleDelete = async (hoardingId: string) => {
    if (!canDeleteHoarding) return;

    const ok = window.confirm("Are you sure you want to delete this hoarding?");
    if (!ok) return;

    try {
      setDeletingId(hoardingId);
      await hoardingsAPI.delete(hoardingId);
      showSuccess("Hoarding deleted successfully.");
      setPage(1);
      setHasMore(true);
      await fetchHoardings(1, true);
    } catch (error) {
      showError("Failed to delete hoarding. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const toFt = (w?: number, h?: number) => {
    if (!w || !h) return "—";
    return `${Math.round(w / 30.48)}ft x ${Math.round(h / 30.48)}ft`;
  };

  const formatStatus = (value: unknown) => {
    const normalized = String(value || "").toLowerCase();
    if (!normalized) return "—";

    if (normalized === "on_rent") return "On Rent";
    if (normalized === "under_process") return "Under Process";
    if (normalized === "tokenized") return "Tokenized";

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const formatRate = (value: unknown) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <ProtectedRoute component="hoardings">
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div>
            <h1>Hoardings Inventory</h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
              Total: {total} hoardings
            </p>
          </div>

          {canCreateHoarding && (
            <Link href="/hoardings/new" className="btn btn-primary">
              Add New Hoarding
            </Link>
          )}
        </div>

        <div className="card" style={{ marginBottom: "16px" }}>
          <h3>Filters</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                City
              </label>
              <OptionAutocomplete
                value={filters.city}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, city: value }))
                }
                options={cityOptions}
                placeholder="Filter by city"
                className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 rounded-md"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Area / Zone
              </label>
              <input
                type="text"
                value={filters.area}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, area: e.target.value }))
                }
                placeholder="Filter by area"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Landmark
              </label>
              <OptionAutocomplete
                value={filters.landmark}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, landmark: value }))
                }
                options={landmarkOptions}
                placeholder="Filter by landmark"
                className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 rounded-md"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Status
              </label>
              <CustomSelect
                value={filters.status}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, status: value }))
                }
                options={[
                  { value: "", label: "All Status" },
                  { value: "available", label: "Available" },
                  { value: "occupied", label: "Occupied" },
                  { value: "booked", label: "Booked" },
                  { value: "on_rent", label: "On Rent" },
                  { value: "under_process", label: "Under Process" },
                  { value: "tokenized", label: "Tokenized" },
                  { value: "live", label: "Live" },
                ]}
                placeholder="All Status"
                openDirection="down"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Category
              </label>
              <CustomSelect
                value={filters.categoryId}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, categoryId: value }))
                }
                options={[
                  { value: "", label: "All Categories" },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
                placeholder="All Categories"
                openDirection="down"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Hoarding Type
              </label>
              <OptionAutocomplete
                value={filters.type}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, type: value }))
                }
                options={typeOptions}
                placeholder="Filter by type"
                className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 rounded-md"
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
            <table className="table">
              <thead>
                <tr>
                  <th>Hoarding Code</th>
                  <th>City</th>
                  <th>Location / Landmark</th>
                  <th>Size</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Standard Rate</th>
                  <th>Minimum Rate</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hoardings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{ textAlign: "center", padding: "30px" }}
                    >
                      No hoardings found
                    </td>
                  </tr>
                ) : (
                  hoardings.map((h: any) => (
                    <tr key={h.id}>
                      {(() => {
                        const hoardingStatus = String(h.status || "")
                          .toLowerCase()
                          .trim();
                        const isBooked = hoardingStatus === "booked";
                        const salesAlreadyBlocked =
                          String(h.myActiveToken || "").toLowerCase() ===
                            "true" || h.myActiveToken === true;
                        const canSalesBlock = ![
                          "booked",
                          "live",
                          "under_process",
                        ].includes(hoardingStatus);

                        return (
                          <>
                            <td>
                              {h.code || "—"} {h.side ? `(${h.side})` : ""}
                            </td>
                            <td>{h.city || "—"}</td>
                            <td>
                              <strong>
                                {h.landmark || h.roadName || h.title || "—"}
                              </strong>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-secondary)",
                                  marginTop: "4px",
                                }}
                              >
                                {[h.area, h.roadName]
                                  .filter(Boolean)
                                  .join(", ") || "—"}
                              </div>
                            </td>
                            <td>{toFt(h.widthCm, h.heightCm)}</td>
                            <td>{h?.category?.name || "—"}</td>
                            <td>{formatStatus(h.status)}</td>
                            <td>{formatRate(h.standardRate)}</td>
                            <td>{formatRate(h.minimumRate)}</td>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  flexWrap: "nowrap",
                                  alignItems: "center",
                                }}
                              >
                                <Link
                                  href={`/hoardings/${h.id}`}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: "5px 10px",
                                    fontSize: "12px",
                                  }}
                                >
                                  View
                                </Link>

                                {isSalesUser &&
                                  canCreateBookingToken &&
                                  (salesAlreadyBlocked ? (
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{
                                        padding: "5px 10px",
                                        fontSize: "12px",
                                      }}
                                      disabled
                                    >
                                      Blocked
                                    </button>
                                  ) : isBooked ? (
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{
                                        padding: "5px 10px",
                                        fontSize: "12px",
                                      }}
                                      disabled
                                    >
                                      Booked
                                    </button>
                                  ) : canSalesBlock ? (
                                    <Link
                                      href={`/hoardings/${h.id}/token`}
                                      className="btn btn-primary"
                                      style={{
                                        padding: "5px 10px",
                                        fontSize: "12px",
                                      }}
                                    >
                                      Block
                                    </Link>
                                  ) : null)}

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
                                    disabled={deletingId === String(h.id)}
                                    onClick={() => handleDelete(String(h.id))}
                                  >
                                    {deletingId === String(h.id)
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {!loading && hasMore && hoardings.length > 0 && (
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
