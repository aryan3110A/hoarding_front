"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import AppLayout, { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";

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
      const authToken = localStorage.getItem("token");
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const [vendorsRes, hoardingsRes] = await Promise.allSettled([
        axios
          .get(`${API_URL}/api/hoardings`, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
          .catch(() => ({
            data: { success: true, data: { hoardings: [], total: 0 } },
          })),
        axios
          .get(`${API_URL}/api/hoardings`, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
          .catch(() => ({
            data: { success: true, data: { hoardings: [], total: 0 } },
          })),
      ]);

      const hoardingsData =
        hoardingsRes.status === "fulfilled"
          ? hoardingsRes.value.data?.data?.hoardings ||
            hoardingsRes.value.data?.hoardings ||
            []
          : [];

      setVendors([]); // Vendors not implemented yet
      setRents([]); // Rents fetched per hoarding
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
      <AppLayout>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Loading...</p>
        </div>
      </AppLayout>
    );
  }

  // Don't show loading spinner - show content immediately with empty state if needed

  const userRole = user?.role?.toLowerCase() || "";
  const allowedRoles = ["owner", "manager", "admin"];

  if (!allowedRoles.includes(userRole)) {
    return <AccessDenied />;
  }

  return (
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
          <h3>Rent Records</h3>
          {rents.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Hoarding</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rents.map((rent) => {
                  const daysUntilDue = Math.ceil(
                    (new Date(rent.dueDate).getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr
                      key={rent.id}
                      style={
                        daysUntilDue <= 7 &&
                        daysUntilDue > 0 &&
                        rent.status !== "Paid"
                          ? { backgroundColor: "#fff3cd" }
                          : {}
                      }
                    >
                      <td>{getVendorName(rent.vendorId)}</td>
                      <td>{getHoardingName(rent.hoardingId)}</td>
                      <td>₹{rent.amount}</td>
                      <td>{new Date(rent.dueDate).toLocaleDateString()}</td>
                      <td>{rent.status}</td>
                      <td>
                        <select
                          value={rent.status}
                          onChange={(e) =>
                            handleUpdateRentStatus(rent.id, e.target.value)
                          }
                          style={{ padding: "5px", fontSize: "12px" }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Paid">Paid</option>
                          <option value="Overdue">Overdue</option>
                        </select>
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
    </AppLayout>
  );
}
