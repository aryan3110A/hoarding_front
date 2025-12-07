"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";
import { rentAPI, hoardingsAPI } from "@/lib/api";

export default function Vendors() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [rents, setRents] = useState<any[]>([]);
  const [hoardings, setHoardings] = useState<any[]>([]);
  const user = useUser();
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [showRentForm, setShowRentForm] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: "",
    contact: "",
    type: "private",
    paymentCycle: "monthly",
  });
  const [rentForm, setRentForm] = useState({
    vendorId: "",
    hoardingId: "",
    amount: "",
    dueDate: "",
  });
  const router = useRouter();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [hoardingsRes, rentsRes] = await Promise.allSettled([
        hoardingsAPI.getAll({ page: 1, limit: 1000 }).catch(() => ({
          success: true,
          data: { hoardings: [], total: 0 },
        })),
        rentAPI.getAll({ page: 1, limit: 1000 }).catch(() => ({
          success: true,
          data: { rents: [], total: 0 },
        })),
      ]);

      const hoardingsData =
        hoardingsRes.status === "fulfilled" &&
        hoardingsRes.value.success &&
        hoardingsRes.value.data
          ? hoardingsRes.value.data.hoardings || []
          : [];

      const rentsData =
        rentsRes.status === "fulfilled" &&
        rentsRes.value.success &&
        rentsRes.value.data
          ? rentsRes.value.data.rents || []
          : [];

      setVendors([]); // Vendors not implemented yet
      setRents(rentsData);
      setHoardings(Array.isArray(hoardingsData) ? hoardingsData : []);
      setLoading(false); // Set loading to false immediately after setting data
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setVendors([]);
      setRents([]);
      setHoardings([]);
      setLoading(false); // Set loading to false on error too
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const authToken = localStorage.getItem("token");
      await axios.post(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/vendors`,
        vendorForm,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      setShowVendorForm(false);
      setVendorForm({
        name: "",
        contact: "",
        type: "private",
        paymentCycle: "monthly",
      });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to create vendor");
    }
  };

  const handleCreateRent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const authToken = localStorage.getItem("token");
      await axios.post(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/rents`,
        {
          ...rentForm,
          amount: parseFloat(rentForm.amount),
          status: "Pending",
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      setShowRentForm(false);
      setRentForm({ vendorId: "", hoardingId: "", amount: "", dueDate: "" });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to create rent record");
    }
  };

  const handleUpdateRentStatus = async (id: string, status: string) => {
    try {
      const authToken = localStorage.getItem("token");
      const rents = await axios.get(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/rents`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const rent = rents.data.find((r: any) => r.id === id);
      if (rent) {
        await axios.put(
          `${
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
          }/api/rents/${id}`,
          {
            ...rent,
            status,
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );
        fetchData();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to update rent status");
    }
  };

  const getVendorName = (id: string) => {
    const vendor = vendors.find((v) => v.id === id);
    return vendor ? vendor.name : id;
  };

  const getHoardingName = (id: string) => {
    const hoarding = hoardings.find((h) => h.id === id);
    return hoarding ? `${hoarding.city}, ${hoarding.area}` : id;
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Don't show loading spinner - show content immediately with empty state if needed

  const userRole = user?.role?.toLowerCase() || "";
  const allowedRoles = ["owner", "manager", "admin"];

  if (!allowedRoles.includes(userRole)) {
    return <AccessDenied />;
  }

  return (
    <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h1>Vendors & Rent Management</h1>
          <div>
            <button
              onClick={() => setShowVendorForm(!showVendorForm)}
              className="btn btn-primary"
              style={{ marginRight: "10px" }}
            >
              {showVendorForm ? "Cancel" : "Add Vendor"}
            </button>
            <button
              onClick={() => setShowRentForm(!showRentForm)}
              className="btn btn-primary"
            >
              {showRentForm ? "Cancel" : "Add Rent Record"}
            </button>
          </div>
        </div>

        {showVendorForm && (
          <div className="card">
            <h3>Add New Vendor</h3>
            <form onSubmit={handleCreateVendor}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "15px",
                }}
              >
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={vendorForm.name}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Contact *</label>
                  <input
                    type="text"
                    value={vendorForm.contact}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, contact: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Type *</label>
                  <select
                    value={vendorForm.type}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, type: e.target.value })
                    }
                    required
                  >
                    <option value="private">Private</option>
                    <option value="government">Government</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Cycle *</label>
                  <select
                    value={vendorForm.paymentCycle}
                    onChange={(e) =>
                      setVendorForm({
                        ...vendorForm,
                        paymentCycle: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Create Vendor
              </button>
            </form>
          </div>
        )}

        {showRentForm && (
          <div className="card">
            <h3>Add Rent Record</h3>
            <form onSubmit={handleCreateRent}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "15px",
                }}
              >
                <div className="form-group">
                  <label>Vendor *</label>
                  <select
                    value={rentForm.vendorId}
                    onChange={(e) =>
                      setRentForm({ ...rentForm, vendorId: e.target.value })
                    }
                    required
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Hoarding *</label>
                  <select
                    value={rentForm.hoardingId}
                    onChange={(e) =>
                      setRentForm({ ...rentForm, hoardingId: e.target.value })
                    }
                    required
                  >
                    <option value="">Select Hoarding</option>
                    {hoardings.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.city}, {h.area}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input
                    type="number"
                    value={rentForm.amount}
                    onChange={(e) =>
                      setRentForm({ ...rentForm, amount: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Due Date *</label>
                  <input
                    type="date"
                    value={rentForm.dueDate}
                    onChange={(e) =>
                      setRentForm({ ...rentForm, dueDate: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Create Rent Record
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <h3>Vendors</h3>
          {vendors.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Payment Cycle</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>{vendor.name}</td>
                    <td>{vendor.contact}</td>
                    <td>{vendor.type}</td>
                    <td>{vendor.paymentCycle}</td>
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
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>💰</div>
              <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>
                No Vendors Yet
              </h3>
              <p style={{ marginBottom: "24px" }}>
                Add your first vendor to start managing rent records.
              </p>
              <button
                onClick={() => setShowVendorForm(true)}
                className="btn btn-primary"
              >
                Add Vendor
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h3>All Rent Records ({rents.length})</h3>
            <button
              className="btn btn-secondary"
              onClick={fetchData}
              style={{ padding: "8px 16px", fontSize: "14px" }}
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
              Loading rent records...
            </p>
          ) : rents.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Hoarding Code</th>
                  <th>Location</th>
                  <th>Party Type</th>
                  <th>Rent Amount</th>
                  <th>Payment Mode</th>
                  <th>Last Payment</th>
                  <th>Next Due Date</th>
                  <th>Days Until Due</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rents.map((rent: any) => {
                  const dueDate = rent.nextDueDate
                    ? new Date(rent.nextDueDate)
                    : null;
                  const today = new Date();
                  const daysUntilDue = dueDate
                    ? Math.ceil(
                        (dueDate.getTime() - today.getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : null;
                  const isUrgent =
                    daysUntilDue !== null &&
                    daysUntilDue <= 7 &&
                    daysUntilDue >= 0;
                  const hoarding = rent.hoarding || {};

                  return (
                    <tr
                      key={rent.id}
                      style={
                        isUrgent
                          ? { backgroundColor: "#fff3cd" }
                          : daysUntilDue !== null && daysUntilDue < 0
                          ? { backgroundColor: "#fee2e2" }
                          : {}
                      }
                    >
                      <td>
                        <strong>{hoarding.code || "N/A"}</strong>
                      </td>
                      <td>
                        {hoarding.city || ""}
                        {hoarding.area && `, ${hoarding.area}`}
                      </td>
                      <td>
                        <span className="badge badge-info">
                          {rent.partyType || "N/A"}
                        </span>
                      </td>
                      <td>₹{Number(rent.rentAmount || 0).toLocaleString()}</td>
                      <td>{rent.paymentMode || "N/A"}</td>
                      <td>
                        {rent.lastPaymentDate
                          ? new Date(rent.lastPaymentDate).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td>
                        {dueDate ? dueDate.toLocaleDateString() : "N/A"}
                      </td>
                      <td>
                        {daysUntilDue !== null ? (
                          <span
                            className={`badge ${
                              isUrgent
                                ? "badge-warning"
                                : daysUntilDue < 0
                                ? "badge-danger"
                                : "badge-info"
                            }`}
                          >
                            {daysUntilDue === 0
                              ? "Due Today"
                              : daysUntilDue < 0
                              ? `Overdue by ${Math.abs(daysUntilDue)} days`
                              : `${daysUntilDue} days`}
                          </span>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-primary"
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                          onClick={() =>
                            router.push(`/hoardings/${rent.hoardingId}/rent`)
                          }
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
              <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>
                No Rent Records Yet
              </h3>
              <p style={{ marginBottom: "24px" }}>
                Create your first rent record to start tracking payments.
              </p>
              <button
                onClick={() => setShowRentForm(true)}
                className="btn btn-primary"
              >
                Add Rent Record
              </button>
            </div>
          )}
        </div>
      </div>
  );
}
