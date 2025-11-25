"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppLayout, { useUser } from "@/components/AppLayout";
import { hoardingsAPI } from "@/lib/api";
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
  const [filters, setFilters] = useState({
    city: "",
    area: "",
    status: "",
  });

  const limit = 20; // Items per page

  // Get user from context or localStorage as fallback
  useEffect(() => {
    console.log("📋 [Hoardings Page] Component mounted");
    console.log("📋 [Hoardings Page] User from context:", userFromContext);

    // Prefer context user if available
    if (userFromContext) {
      console.log("📋 [Hoardings Page] User found in context");
      setUser(userFromContext);
      return;
    }

    // Fallback to localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        console.log(
          "📋 [Hoardings Page] User found in localStorage:",
          parsedUser
        );
        setUser(parsedUser);
      } catch (error) {
        console.error(
          "📋 [Hoardings Page] Error parsing user from localStorage:",
          error
        );
      }
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
      setHoardings([]);
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

    loadInitial();
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
  console.log("📋 [Hoardings Page] User object:", user);
  console.log("📋 [Hoardings Page] Extracted role:", userRole);
  console.log(
    "📋 [Hoardings Page] User object keys:",
    user ? Object.keys(user) : "No user"
  );

  const canCreateHoarding = canCreate(userRole, "hoardings");
  const canEditHoarding = canUpdate(userRole, "hoardings");
  const canDeleteHoarding = canDelete(userRole, "hoardings");

  console.log("📋 [Hoardings Page] Permissions:", {
    role: userRole,
    canCreate: canCreateHoarding,
    canEdit: canEditHoarding,
    canDelete: canDeleteHoarding,
  });

  if (loading) {
    return (
      <AppLayout>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
          <p>Loading hoardings...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <ProtectedRoute component="hoardings">
      <AppLayout>
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
              <h1>Hoardings Master</h1>
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
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                >
                  <option value="">All</option>
                  <option value="available">Available</option>
                  <option value="on_rent">On Rent</option>
                  <option value="occupied">Occupied</option>
                  <option value="booked">Booked</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Location</th>
                  <th>Size</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Base Rate</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hoardings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ textAlign: "center", padding: "40px" }}
                    >
                      No hoardings found
                    </td>
                  </tr>
                ) : (
                  hoardings.map((hoarding) => (
                    <tr key={hoarding.id}>
                      <td>
                        <strong>{hoarding.code}</strong>
                      </td>
                      <td>
                        {hoarding.city || ""}
                        {hoarding.area && `, ${hoarding.area}`}
                        {hoarding.landmark && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {hoarding.landmark}
                          </div>
                        )}
                      </td>
                      <td>
                        {hoarding.widthCm && hoarding.heightCm
                          ? `${Math.round(
                              hoarding.widthCm / 30.48
                            )}ft x ${Math.round(hoarding.heightCm / 30.48)}ft`
                          : "N/A"}
                      </td>
                      <td>{hoarding.type || "N/A"}</td>
                      <td>
                        <span
                          className={`badge ${
                            hoarding.status === "available"
                              ? "badge-success"
                              : hoarding.status === "on_rent"
                              ? "badge-info"
                              : hoarding.status === "occupied"
                              ? "badge-danger"
                              : "badge-warning"
                          }`}
                        >
                          {hoarding.status === "on_rent"
                            ? "On Rent"
                            : hoarding.status || "available"}
                        </span>
                      </td>
                      <td>
                        {hoarding.baseRate
                          ? `₹${Number(hoarding.baseRate).toLocaleString()}`
                          : "N/A"}
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          {/* Owner can always give hoarding on rent */}
                          {(userRole?.toLowerCase() === "owner" ||
                            userRole?.toLowerCase() === "admin" ||
                            canViewRent(userRole)) && (
                            <button
                              className="btn btn-primary"
                              style={{
                                padding: "5px 10px",
                                fontSize: "12px",
                                fontWeight:
                                  userRole?.toLowerCase() === "owner"
                                    ? "600"
                                    : "normal",
                              }}
                              onClick={() =>
                                router.push(`/hoardings/${hoarding.id}/rent`)
                              }
                              title={
                                userRole?.toLowerCase() === "owner"
                                  ? "Give this hoarding on rent"
                                  : "View/Manage Rent"
                              }
                            >
                              {userRole?.toLowerCase() === "owner"
                                ? "💰 Give on Rent"
                                : "Rent"}
                            </button>
                          )}
                          <Link
                            href={`/hoardings/${hoarding.id}`}
                            className="btn btn-secondary"
                            style={{ padding: "5px 10px", fontSize: "12px" }}
                          >
                            View
                          </Link>
                          {canEditHoarding && (
                            <Link
                              href={`/hoardings/${hoarding.id}/edit`}
                              className="btn btn-warning"
                              style={{ padding: "5px 10px", fontSize: "12px" }}
                            >
                              Edit
                            </Link>
                          )}
                          {canDeleteHoarding && (
                            <button
                              className="btn btn-danger"
                              style={{ padding: "5px 10px", fontSize: "12px" }}
                              onClick={async () => {
                                if (
                                  confirm(
                                    `Are you sure you want to delete hoarding ${hoarding.code}?`
                                  )
                                ) {
                                  try {
                                    await hoardingsAPI.delete(hoarding.id);
                                    // Refresh the list
                                    fetchHoardings(1, true);
                                  } catch (error: any) {
                                    alert(
                                      error.response?.data?.message ||
                                        "Failed to delete hoarding"
                                    );
                                  }
                                }
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {hasMore && hoardings.length > 0 && (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <button
                  className="btn btn-primary"
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{ minWidth: "150px" }}
                >
                  {loadingMore ? "Loading..." : "See More"}
                </button>
                <p
                  style={{
                    marginTop: "10px",
                    color: "var(--text-secondary)",
                    fontSize: "14px",
                  }}
                >
                  Showing {hoardings.length} of {total} hoardings
                </p>
              </div>
            )}

            {!hasMore && hoardings.length > 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "var(--text-secondary)",
                }}
              >
                <p>All {total} hoardings loaded</p>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
