"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import AppLayout, { useUser } from "@/components/AppLayout";
import { rentAPI, hoardingsAPI } from "@/lib/api";
import { getRoleFromUser, canEditRent } from "@/lib/rbac";

export default function RentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const userFromContext = useUser();
  const [user, setUser] = useState<any>(null);
  const hoardingId = params.id as string;

  const [hoarding, setHoarding] = useState<any>(null);
  const [rent, setRent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const [formData, setFormData] = useState({
    partyType: "Private",
    rentAmount: "",
    incrementYear: "",
    paymentMode: "Monthly",
    lastPaymentDate: "",
  });

  // Load user from context or localStorage
  useEffect(() => {
    if (userFromContext) {
      setUser(userFromContext);
    } else {
      const localUser = localStorage.getItem("user");
      if (localUser) {
        try {
          setUser(JSON.parse(localUser));
        } catch (e) {
          console.error("Failed to parse user from localStorage", e);
        }
      }
    }
  }, [userFromContext]);

  useEffect(() => {
    fetchData();
  }, [hoardingId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch hoarding details
      const hoardingResponse = await hoardingsAPI.getById(hoardingId);
      if (hoardingResponse.success) {
        setHoarding(hoardingResponse.data);
      }

      // Fetch rent details
      try {
        const rentResponse = await rentAPI.getRentDetails(hoardingId);
        if (rentResponse.success && rentResponse.data) {
          const rentData = rentResponse.data;
          setRent(rentData);
          setFormData({
            partyType: rentData.partyType || "Private",
            rentAmount: rentData.rentAmount ? String(rentData.rentAmount) : "",
            incrementYear: rentData.incrementYear
              ? String(rentData.incrementYear)
              : "",
            paymentMode: rentData.paymentMode || "Monthly",
            lastPaymentDate: rentData.lastPaymentDate
              ? new Date(rentData.lastPaymentDate).toISOString().split("T")[0]
              : "",
          });
        }
      } catch (error: any) {
        // Rent not found is okay, user can create new
        if (error.response?.status !== 404) {
          console.error("Error fetching rent:", error);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      alert("Failed to load hoarding details");
      router.push("/hoardings");
    } finally {
      setLoading(false);
    }
  };

  const calculateNextDueDate = (
    lastPaymentDate: string,
    paymentMode: string
  ): string => {
    if (!lastPaymentDate) return "";

    const date = new Date(lastPaymentDate);
    switch (paymentMode) {
      case "Monthly":
        date.setMonth(date.getMonth() + 1);
        break;
      case "Quarterly":
        date.setMonth(date.getMonth() + 3);
        break;
      case "Half-Yearly":
        date.setMonth(date.getMonth() + 6);
        break;
      case "Yearly":
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toISOString().split("T")[0];
  };

  const nextDueDate = calculateNextDueDate(
    formData.lastPaymentDate,
    formData.paymentMode
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.rentAmount || !formData.partyType || !formData.paymentMode) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const response = await rentAPI.saveRent(hoardingId, {
        partyType: formData.partyType,
        rentAmount: parseFloat(formData.rentAmount),
        incrementYear: formData.incrementYear
          ? parseInt(formData.incrementYear)
          : null,
        paymentMode: formData.paymentMode,
        lastPaymentDate: formData.lastPaymentDate || null,
      });

      if (response.success) {
        alert("Rent details saved successfully!");
        fetchData();
      } else {
        alert("Failed to save: " + (response.message || "Unknown error"));
      }
    } catch (error: any) {
      alert(
        "Error saving rent: " +
          (error.response?.data?.message || "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (!confirm("Recalculate rent? This will increase the rent by 10%.")) {
      return;
    }

    try {
      setRecalculating(true);
      const response = await rentAPI.recalculateRent(hoardingId);
      if (response.success) {
        alert("Rent recalculated successfully!");
        fetchData();
      } else {
        alert(
          "Failed to recalculate: " + (response.message || "Unknown error")
        );
      }
    } catch (error: any) {
      alert(
        "Error recalculating rent: " +
          (error.response?.data?.message || "Unknown error")
      );
    } finally {
      setRecalculating(false);
    }
  };

  // Robust role extraction with fallback and debug
  const extractedRole = getRoleFromUser(user);
  const rawRole = (user as any)?.role || (user as any)?.userRole || "";
  const userRole =
    extractedRole || (typeof rawRole === "string" ? rawRole : "");
  const canEdit = canEditRent(userRole);
  const fallbackRoleLower = (user as any)?.role?.toLowerCase?.() || "";
  const canEditFinal =
    canEdit || ["owner", "manager", "admin"].includes(fallbackRoleLower);

  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log("[RentPage] user object:", user);
      console.log(
        "[RentPage] extractedRole:",
        extractedRole,
        "rawRole:",
        rawRole,
        "final userRole:",
        userRole,
        "canEdit:",
        canEdit
      );
    }
  }, [user, extractedRole, rawRole, userRole, canEdit]);

  if (loading) {
    return (
      <AppLayout>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
          <p>Loading rent details...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div>
        <div style={{ marginBottom: "24px" }}>
          <button
            className="btn btn-secondary"
            onClick={() => router.back()}
            style={{ marginBottom: "16px" }}
          >
            ← Back
          </button>
          <h1>Rent Details</h1>
          {hoarding && (
            <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
              Hoarding: <strong>{hoarding.code}</strong> - {hoarding.city}
              {hoarding.area && `, ${hoarding.area}`}
            </p>
          )}
        </div>

        {rent && (
          <div className="card" style={{ marginBottom: "24px" }}>
            <h3>Current Rent Information</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "16px",
              }}
            >
              <div>
                <strong>Rent Amount:</strong> ₹
                {Number(rent.rentAmount).toLocaleString()}
              </div>
              <div>
                <strong>Party Type:</strong> {rent.partyType}
              </div>
              <div>
                <strong>Payment Mode:</strong> {rent.paymentMode}
              </div>
              {rent.nextDueDate && (
                <div>
                  <strong>Next Due Date:</strong>{" "}
                  {new Date(rent.nextDueDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}

        {canEditFinal ? (
          <div className="card">
            <h3>{rent ? "Update" : "Add"} Rent Details</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Party Type <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  value={formData.partyType}
                  onChange={(e) =>
                    setFormData({ ...formData, partyType: e.target.value })
                  }
                  required
                  disabled={saving}
                >
                  <option value="Government">Government</option>
                  <option value="Private">Private</option>
                  <option value="Friend">Friend</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Rent Amount <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="number"
                  value={formData.rentAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, rentAmount: e.target.value })
                  }
                  placeholder="Enter rent amount"
                  required
                  min="0"
                  step="0.01"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label>Increment Year</label>
                <input
                  type="number"
                  value={formData.incrementYear}
                  onChange={(e) =>
                    setFormData({ ...formData, incrementYear: e.target.value })
                  }
                  placeholder="Year when rent increment applies (e.g., 2026)"
                  min="2020"
                  max="2100"
                  disabled={saving}
                />
                <small
                  style={{ color: "var(--text-secondary)", fontSize: "12px" }}
                >
                  Rent will increase by 10% when this year is reached
                </small>
              </div>

              <div className="form-group">
                <label>
                  Payment Mode <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  value={formData.paymentMode}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentMode: e.target.value })
                  }
                  required
                  disabled={saving}
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Half-Yearly">Half-Yearly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>

              <div className="form-group">
                <label>Last Payment Date</label>
                <input
                  type="date"
                  value={formData.lastPaymentDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lastPaymentDate: e.target.value,
                    })
                  }
                  disabled={saving}
                />
              </div>

              {nextDueDate && (
                <div className="form-group">
                  <label>Next Due Date (Auto-calculated)</label>
                  <input
                    type="text"
                    value={new Date(nextDueDate).toLocaleDateString()}
                    disabled
                    style={{ background: "#f8fafc" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : rent ? "Update Rent" : "Save Rent"}
                </button>
                {rent && (
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={handleRecalculate}
                    disabled={recalculating}
                  >
                    {recalculating
                      ? "Recalculating..."
                      : "Recalculate Rent (+10%)"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => router.back()}
                  disabled={saving || recalculating}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="card">
            <p>You don't have permission to edit rent details.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
