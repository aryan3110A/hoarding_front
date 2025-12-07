"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { canCreate, canUpdate, canAssignTasks } from "@/lib/rbac";
import { designAssignmentsAPI, tasksAPI } from "@/lib/api";

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
      const userRole = user?.role?.toLowerCase() || "";

      if (userRole === "designer") {
        // Designer only sees their own assignments
        const response = await designAssignmentsAPI.getAll({
          designerId: user?.id,
        });
        if (response.success && response.data) {
          const assignments = Array.isArray(response.data)
            ? response.data
            : response.data.assignments || [];
          setDesigns(assignments);
        }
      } else {
        // Owner/Manager see all design assignments
        const response = await designAssignmentsAPI.getAll();
        if (response.success && response.data) {
          const assignments = Array.isArray(response.data)
            ? response.data
            : response.data.assignments || [];
          setDesigns(assignments);
        }
      }
    } catch (error) {
      console.error("Failed to fetch design assignments:", error);
      setDesigns([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const userRole = user?.role || "";
  const userRoleLower = userRole?.toLowerCase() || "";
  const canCreateDesign = canCreate(userRole, "designAssignments");
  const canUpdateDesign = canUpdate(userRole, "designAssignments");
  const canAssignDesign = canAssignTasks(userRole);

  console.log(user);

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
              <h3>{designs.filter((d) => d.status === "pending").length}</h3>
              <p>Pending Designs</p>
            </div>
            <div className="stat-card">
              <h3>
                {designs.filter((d) => d.status === "in_progress").length}
              </h3>
              <p>In Progress</p>
            </div>
            <div className="stat-card">
              <h3>{designs.filter((d) => d.status === "completed").length}</h3>
              <p>Completed</p>
            </div>
            <div className="stat-card">
              <h3>{designs.length}</h3>
              <p>Total Designs</p>
            </div>
          </div>

          <div className="card" style={{ marginTop: "24px" }}>
            <h3>Design Assignments</h3>
            {designs.length > 0 ? (
              <table className="table" style={{ marginTop: "16px" }}>
                <thead>
                  <tr>
                    <th>Hoarding Code</th>
                    <th>Client</th>
                    <th>Title</th>
                    <th>Assigned To</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {designs.map((design) => (
                    <tr key={design.id}>
                      <td>{design.hoardingCode}</td>
                      <td>{design.clientName}</td>
                      <td>{design.title}</td>
                      <td>{design.assignedTo}</td>
                      <td>
                        {design.dueDate
                          ? new Date(design.dueDate).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            design.status === "completed"
                              ? "badge-success"
                              : design.status === "in_progress"
                              ? "badge-warning"
                              : "badge-info"
                          }`}
                        >
                          {design.status || "New"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-primary"
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                          onClick={() =>
                            alert(`View/Edit Design: ${design.title}`)
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
                <h3
                  style={{ marginBottom: "8px", color: "var(--text-primary)" }}
                >
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
