"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  canCreate,
  canUpdate,
  canAssignTasks,
  getRoleFromUser,
} from "@/lib/rbac";
import { bookingTokensAPI } from "@/lib/api";

export default function Design() {
  const user = useUser();
  const router = useRouter();
  const [designs, setDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDesigns();
    }
  }, [user]);

  const fetchDesigns = async () => {
    try {
      setLoading(true);
      const roleLower = String(getRoleFromUser(user) || "").toLowerCase();
      if (roleLower !== "designer") {
        setDesigns([]);
        return;
      }

      const response = await bookingTokensAPI.assigned();
      if (response.success && response.data) {
        const rows = Array.isArray(response.data)
          ? response.data
          : response.data.tokens || [];
        setDesigns(rows || []);
      } else {
        setDesigns([]);
      }
    } catch (error) {
      console.error("Failed to fetch design assignments:", error);
      setDesigns([]);
    } finally {
      setLoading(false);
    }
  };

  // Live updates: refresh when a notification arrives
  useEffect(() => {
    const roleLower = String(getRoleFromUser(user) || "").toLowerCase();
    if (roleLower !== "designer") return;
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:3001";
    const accessToken =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const query = accessToken
      ? `?token=${encodeURIComponent(accessToken)}`
      : "";
    const url = `${apiBase}/api/events/notifications${query}`;
    const source = new EventSource(url as any);
    source.onmessage = () => {
      // Re-fetch assignments; backend only emits for this user
      fetchDesigns();
    };
    source.onerror = () => {
      // ignore; browser reconnects
    };
    return () => {
      try {
        source.close();
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const userRole = getRoleFromUser(user);
  const userRoleLower = String(userRole || "").toLowerCase();
  const canCreateDesign = canCreate(userRole, "designAssignments");
  const canUpdateDesign = canUpdate(userRole, "designAssignments");
  const canAssignDesign = canAssignTasks(userRole);

  const normalizeStatus = (raw: any) => {
    const s = String(raw || "PENDING").toUpperCase();
    if (s === "PENDING") return "pending";
    if (s === "IN_PROGRESS") return "in_progress";
    if (s === "COMPLETED") return "completed";
    return String(raw || "pending").toLowerCase();
  };

  return (
    <ProtectedRoute component="designAssignments">
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <div>
            <h1>Design Management</h1>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "16px",
                marginTop: "8px",
              }}
            >
              Manage design assignments and creative tasks
            </p>
          </div>
          {canCreateDesign && (
            <button
              className="btn btn-primary"
              onClick={() =>
                alert("Create new design assignment - Feature coming soon")
              }
            >
              + New Design Assignment
            </button>
          )}
        </div>

        <div className="grid">
          <div className="stat-card">
            <h3>
              {
                designs.filter(
                  (d) => normalizeStatus(d.designStatus) === "pending"
                ).length
              }
            </h3>
            <p>Pending Designs</p>
          </div>
          <div className="stat-card">
            <h3>
              {
                designs.filter(
                  (d) => normalizeStatus(d.designStatus) === "in_progress"
                ).length
              }
            </h3>
            <p>In Progress</p>
          </div>
          <div className="stat-card">
            <h3>
              {
                designs.filter(
                  (d) => normalizeStatus(d.designStatus) === "completed"
                ).length
              }
            </h3>
            <p>Completed</p>
          </div>
          <div className="stat-card">
            <h3>{designs.length}</h3>
            <p>Total Designs</p>
          </div>
        </div>

        <div className="card" style={{ marginTop: "24px" }}>
          <h3>Design Assignments</h3>
          {userRoleLower !== "designer" ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--text-secondary)",
              }}
            >
              Design assignments are available in Designer accounts.
            </div>
          ) : designs.length > 0 ? (
            <table className="table" style={{ marginTop: "16px" }}>
              <thead>
                <tr>
                  <th>Hoarding Code</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {designs.map((t) => (
                  <tr key={t.id}>
                    <td>{t.hoarding?.code || t.hoardingId}</td>
                    <td>{t.client?.name || "—"}</td>
                    <td>
                      <span
                        className={`badge ${
                          normalizeStatus(t.designStatus) === "completed"
                            ? "badge-success"
                            : normalizeStatus(t.designStatus) === "in_progress"
                            ? "badge-warning"
                            : "badge-info"
                        }`}
                      >
                        {normalizeStatus(t.designStatus).replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                        onClick={() =>
                          router.push(
                            `/booking-tokens/${t.id}?from=notification`
                          )
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎨</div>
              <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>
                No Design Assignments Yet
              </h3>
              <p style={{ marginBottom: "24px" }}>
                Design tasks will appear here once assigned.
              </p>
            </div>
          )}
        </div>

        {canAssignDesign && (
          <div className="card" style={{ marginTop: "24px" }}>
            <h3>Quick Actions</h3>
            <div
              style={{
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
                marginTop: "16px",
              }}
            >
              <button
                className="btn btn-primary"
                onClick={() => router.push("/tasks")}
              >
                View All Tasks
              </button>
              <button
                className="btn btn-primary"
                onClick={() => router.push("/hoardings")}
              >
                View Hoardings
              </button>
              <button
                className="btn btn-primary"
                onClick={() => router.push("/bookings")}
              >
                View Bookings
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
