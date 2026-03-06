"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";
import { rentAPI, hoardingsAPI, landlordsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";
import { canDelete, canUpdate, getRoleFromUser } from "@/lib/rbac";

export default function Vendors() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [rents, setRents] = useState<any[]>([]);
  const [hoardings, setHoardings] = useState<any[]>([]);
  const [landlordGroups, setLandlordGroups] = useState<any[]>([]);
  const [landlordSearch, setLandlordSearch] = useState("");
  const [expandedLandlords, setExpandedLandlords] = useState<Set<string>>(
    new Set(),
  );
  const [deletingHoardingId, setDeletingHoardingId] = useState<string | null>(
    null,
  );
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
  const [loading, setLoading] = useState(true);

  const user = useUser();
  const router = useRouter();

  const userRole = getRoleFromUser(user);
  const allowedRoles = ["owner", "manager", "admin"];
  const canEditHoarding = canUpdate(userRole, "hoardings");
  const canDeleteHoarding = canDelete(userRole, "hoardings");

  const toFt = (widthCm?: number, heightCm?: number) => {
    if (!widthCm || !heightCm) return "—";
    return `${Math.round(widthCm / 30.48)}ft x ${Math.round(heightCm / 30.48)}ft`;
  };

  const formatStatus = (value: unknown) => {
    const normalized = String(value || "").toLowerCase();
    if (!normalized) return "—";
    if (normalized === "on_rent") return "On Rent";
    if (normalized === "under_process") return "Under Process";
    if (normalized === "tokenized") return "Tokenized";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const [hoardingsRes, rentsRes, landlordsRes] = await Promise.allSettled([
        hoardingsAPI.getAll({ page: 1, limit: 2000 }).catch(() => ({
          success: true,
          data: { hoardings: [], total: 0 },
        })),
        rentAPI.getAll({ page: 1, limit: 1000 }).catch(() => ({
          success: true,
          data: { rents: [], total: 0 },
        })),
        landlordsAPI.groupedHoardings().catch(() => ({
          success: true,
          data: [],
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

      const landlordGroupsData =
        landlordsRes.status === "fulfilled" &&
        landlordsRes.value.success &&
        Array.isArray(landlordsRes.value.data)
          ? landlordsRes.value.data
          : [];

      setVendors([]);
      setRents(rentsData);
      setHoardings(Array.isArray(hoardingsData) ? hoardingsData : []);
      setLandlordGroups(
        Array.isArray(landlordGroupsData) ? landlordGroupsData : [],
      );
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setVendors([]);
      setRents([]);
      setHoardings([]);
      setLandlordGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const filteredLandlordGroups = useMemo(() => {
    const query = landlordSearch.trim().toLowerCase();
    return landlordGroups.filter((row: any) => {
      const landlord = String(row?.landlordName || "")
        .trim()
        .toLowerCase();
      if (!query) return true;
      return landlord.includes(query);
    });
  }, [landlordGroups, landlordSearch]);

  const toggleLandlord = (landlord: string) => {
    setExpandedLandlords((prev) => {
      const next = new Set(prev);
      if (next.has(landlord)) {
        next.delete(landlord);
      } else {
        next.add(landlord);
      }
      return next;
    });
  };

  const openEditRent = (landlord: string) => {
    const encoded = encodeURIComponent(landlord);
    router.push(`/landlords/${encoded}/rent?from=vendors`);
  };

  const handleDeleteHoarding = async (hoardingId: string) => {
    if (!canDeleteHoarding) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this hoarding?",
    );
    if (!confirmed) return;

    try {
      setDeletingHoardingId(hoardingId);
      await hoardingsAPI.delete(hoardingId);
      showSuccess("Hoarding deleted successfully.");
      await fetchData();
    } catch {
      showError("Failed to delete hoarding. Please try again.");
    } finally {
      setDeletingHoardingId(null);
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
        },
      );

      setShowVendorForm(false);
      setVendorForm({
        name: "",
        contact: "",
        type: "private",
        paymentCycle: "monthly",
      });
      await fetchData();
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
        },
      );

      setShowRentForm(false);
      setRentForm({ vendorId: "", hoardingId: "", amount: "", dueDate: "" });
      await fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to create rent record");
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!allowedRoles.includes(String(userRole || "").toLowerCase())) {
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
        <h1>Vendors & Landlord Management</h1>
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

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0 }}>Landlords & Hoardings</h3>
          <div style={{ minWidth: "280px", flex: 1, maxWidth: "420px" }}>
            <input
              type="text"
              value={landlordSearch}
              onChange={(e) => setLandlordSearch(e.target.value)}
              placeholder="Search landlord name..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>
        </div>

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px 20px",
              color: "var(--text-secondary)",
            }}
          >
            Loading landlord data...
          </div>
        ) : filteredLandlordGroups.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px 20px",
              color: "var(--text-secondary)",
            }}
          >
            {landlordSearch.trim()
              ? "No landlords found matching your search"
              : "No landlord data found"}
          </div>
        ) : (
          <div>
            {filteredLandlordGroups.map((row: any) => {
              const landlord = String(row?.landlordName || "Unknown");
              const landlordHoardings = Array.isArray(row?.hoardings)
                ? row.hoardings
                : [];
              const isExpanded = expandedLandlords.has(landlord);

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
                  <div
                    onClick={() => toggleLandlord(landlord)}
                    style={{
                      padding: "14px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      background: isExpanded
                        ? "var(--primary-light, rgba(0, 187, 241, 0.12))"
                        : "var(--bg-secondary, #fff)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {landlord}
                      </span>
                      <span
                        style={{
                          fontSize: "13px",
                          color: "var(--text-secondary)",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background:
                            "var(--primary-light, rgba(0, 187, 241, 0.15))",
                        }}
                      >
                        {landlordHoardings.length} hoardings
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLandlord(landlord);
                        }}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditRent(landlord);
                        }}
                      >
                        Edit Rent
                      </button>
                      <span
                        style={{
                          transform: isExpanded
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                          color: "var(--text-secondary)",
                          fontSize: "18px",
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: "16px" }}>
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
                          {landlordHoardings.map((h: any) => {
                            const isDeleting =
                              deletingHoardingId === String(h.id);

                            return (
                              <tr key={h.id}>
                                <td>
                                  <strong>{h.city || "—"}</strong>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      color: "var(--text-secondary)",
                                      marginTop: "4px",
                                    }}
                                  >
                                    {[h.area, h.landmark || h.roadName || ""]
                                      .filter(Boolean)
                                      .join(", ") || "—"}
                                  </div>
                                </td>
                                <td>
                                  {h.code || "—"} {h.side ? `(${h.side})` : ""}
                                </td>
                                <td>{toFt(h.widthCm, h.heightCm)}</td>
                                <td>{formatStatus(h.status)}</td>
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
                                        disabled={isDeleting}
                                        onClick={() =>
                                          handleDeleteHoarding(String(h.id))
                                        }
                                      >
                                        {isDeleting ? "Deleting..." : "Delete"}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
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
                  {hoardings.map((hoarding) => (
                    <option key={hoarding.id} value={hoarding.id}>
                      {hoarding.city}, {hoarding.area}
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
                        (1000 * 60 * 60 * 24),
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
                    <td>{dueDate ? dueDate.toLocaleDateString() : "N/A"}</td>
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
