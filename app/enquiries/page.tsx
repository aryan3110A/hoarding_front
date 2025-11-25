"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import AppLayout, { useUser } from "@/components/AppLayout";
import { canCreate, canUpdate, canAssignTasks } from "@/lib/rbac";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Enquiries() {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUser();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    clientName: "",
    contact: "",
    source: "call",
    hoardingId: "",
    preferredArea: "",
    campaignDates: "",
    budget: "",
    assignedTo: "",
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem("token");
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const [enquiriesRes, usersRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/enquiries`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        axios.get(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      const enquiriesData =
        enquiriesRes.status === "fulfilled"
          ? enquiriesRes.value.data?.data || enquiriesRes.value.data?.data || []
          : [];
      setEnquiries(Array.isArray(enquiriesData) ? enquiriesData : []);

      if (
        (user?.role?.toLowerCase() === "admin" ||
          user?.role?.toLowerCase() === "owner") &&
        usersRes.status === "fulfilled"
      ) {
        const usersData =
          usersRes.value.data?.data || usersRes.value.data || [];
        setUsers(
          Array.isArray(usersData)
            ? usersData.filter((u: any) => u.role?.toLowerCase() === "sales")
            : []
        );
      }
      setLoading(false); // Set loading to false immediately after setting data
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setEnquiries([]);
      setLoading(false); // Set loading to false on error too
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const authToken = localStorage.getItem("token");
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      await axios.post(`${API_URL}/api/enquiries`, formData, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setShowForm(false);
      setFormData({
        clientName: "",
        contact: "",
        source: "call",
        hoardingId: "",
        preferredArea: "",
        campaignDates: "",
        budget: "",
        assignedTo: "",
      });
      fetchData();
      alert("Enquiry created successfully!");
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to create enquiry"
      );
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const authToken = localStorage.getItem("token");
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      await axios.put(
        `${API_URL}/api/enquiries/${id}`,
        {
          status,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      fetchData();
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to update enquiry"
      );
    }
  };

  const getWhatsAppLink = (enquiry: any) => {
    const message = `Dear ${enquiry.clientName}, the hoarding at ${
      enquiry.preferredArea || "your preferred location"
    } is now available. Would you like to proceed?`;
    return `https://wa.me/${enquiry.contact.replace(
      /\D/g,
      ""
    )}?text=${encodeURIComponent(message)}`;
  };

  if (!user) {
    return (
      <AppLayout>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Loading...</p>
        </div>
      </AppLayout>
    );
  }

  // Don't show loading spinner - show content immediately with empty state if needed

  const userRole = user?.role || "";
  const canCreateEnquiry = canCreate(userRole, "enquiries");
  const canUpdateEnquiry = canUpdate(userRole, "enquiries");
  const canAssignEnquiries = canAssignTasks(userRole);

  return (
    <ProtectedRoute component="enquiries">
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
            <h1>Enquiries</h1>
            {canCreateEnquiry && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="btn btn-primary"
              >
                {showForm ? "Cancel" : "New Enquiry"}
              </button>
            )}
          </div>

          {showForm && canCreateEnquiry && (
            <div className="card">
              <h3>Create New Enquiry</h3>
              <form onSubmit={handleSubmit}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "15px",
                  }}
                >
                  <div className="form-group">
                    <label>Client Name *</label>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) =>
                        setFormData({ ...formData, clientName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact *</label>
                    <input
                      type="text"
                      value={formData.contact}
                      onChange={(e) =>
                        setFormData({ ...formData, contact: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Source *</label>
                    <select
                      value={formData.source}
                      onChange={(e) =>
                        setFormData({ ...formData, source: e.target.value })
                      }
                      required
                    >
                      <option value="call">Call</option>
                      <option value="walk-in">Walk-in</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Preferred Area</label>
                    <input
                      type="text"
                      value={formData.preferredArea}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          preferredArea: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Campaign Dates</label>
                    <input
                      type="text"
                      value={formData.campaignDates}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          campaignDates: e.target.value,
                        })
                      }
                      placeholder="e.g., Jan 1 - Jan 15"
                    />
                  </div>
                  <div className="form-group">
                    <label>Budget</label>
                    <input
                      type="number"
                      value={formData.budget}
                      onChange={(e) =>
                        setFormData({ ...formData, budget: e.target.value })
                      }
                    />
                  </div>
                  {canAssignEnquiries && (
                    <div className="form-group">
                      <label>Assign To</label>
                      <select
                        value={formData.assignedTo}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            assignedTo: e.target.value,
                          })
                        }
                      >
                        <option value="">Auto-assign</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <button type="submit" className="btn btn-primary">
                  Create Enquiry
                </button>
              </form>
            </div>
          )}

          <div className="card">
            <h3>All Enquiries</h3>
            {enquiries.length > 0 ? (
              <table className="table" style={{ marginTop: "16px" }}>
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Contact</th>
                    <th>Source</th>
                    <th>Preferred Area</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((enquiry) => (
                    <tr key={enquiry.id}>
                      <td>{enquiry.clientName}</td>
                      <td>{enquiry.contact}</td>
                      <td>{enquiry.source}</td>
                      <td>{enquiry.preferredArea || "-"}</td>
                      <td>{enquiry.status}</td>
                      <td>
                        {canUpdateEnquiry ? (
                          <select
                            value={enquiry.status}
                            onChange={(e) =>
                              handleUpdateStatus(enquiry.id, e.target.value)
                            }
                            style={{ padding: "5px", fontSize: "12px" }}
                          >
                            <option value="Open">Open</option>
                            <option value="Won">Won</option>
                            <option value="Lost">Lost</option>
                            <option value="Waitlist">Waitlist</option>
                          </select>
                        ) : (
                          <span>{enquiry.status}</span>
                        )}
                        {canUpdateEnquiry && enquiry.status === "Waitlist" && (
                          <a
                            href={getWhatsAppLink(enquiry)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary"
                            style={{
                              padding: "5px 10px",
                              fontSize: "12px",
                              marginLeft: "5px",
                            }}
                          >
                            WhatsApp
                          </a>
                        )}
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
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
                <h3
                  style={{ marginBottom: "8px", color: "var(--text-primary)" }}
                >
                  No Enquiries Yet
                </h3>
                <p style={{ marginBottom: "24px" }}>
                  Start tracking your leads by creating your first enquiry.
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="btn btn-primary"
                >
                  New Enquiry
                </button>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
