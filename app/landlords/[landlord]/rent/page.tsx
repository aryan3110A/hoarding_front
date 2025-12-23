"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import { rentAPI, hoardingsAPI } from "@/lib/api";
import { getRoleFromUser, canEditRent } from "@/lib/rbac";
import { showSuccess, showError } from "@/lib/toast";

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDateOnlyUTC(value: string): Date | null {
  if (!value) return null;
  const parts = value.split("-").map((p) => Number(p));
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatDateOnlyUTC(date: Date) {
  return date.toISOString().split("T")[0];
}

function todayDateOnlyUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function daysInMonthUTC(year: number, monthIndex0: number) {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function addYearsClampedUTC(date: Date, years: number) {
  const y = date.getUTCFullYear() + years;
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const maxDay = daysInMonthUTC(y, m);
  const clampedDay = Math.min(d, maxDay);
  return new Date(Date.UTC(y, m, clampedDay));
}

function calculateNextIncrementPreview(args: {
  rentStartDate: string;
  baseRent: number;
  incrementCycleYears: number;
  incrementType: "PERCENTAGE" | "AMOUNT";
  incrementRatePercent: number;
  incrementAmount: number;
  referenceDate?: Date;
}): { nextDate?: string; nextRent?: number } {
  const start = parseDateOnlyUTC(args.rentStartDate);
  if (!start) return {};

  const cycleYears = Number(args.incrementCycleYears || 0);
  if (!Number.isFinite(cycleYears) || cycleYears <= 0) return {};

  const baseRent = Number(args.baseRent);
  if (!Number.isFinite(baseRent) || baseRent <= 0) return {};

  const today = args.referenceDate ? args.referenceDate : todayDateOnlyUTC();

  // How many full cycles have passed since the Rent Start Date (anchored to start date).
  let cyclesPassed = 0;
  if (today.getTime() >= start.getTime()) {
    const yearsDiff = today.getUTCFullYear() - start.getUTCFullYear();
    let guess = Math.floor(yearsDiff / cycleYears);

    while (guess > 0) {
      const d = addYearsClampedUTC(start, guess * cycleYears);
      if (d.getTime() <= today.getTime()) break;
      guess--;
    }
    while (true) {
      const next = addYearsClampedUTC(start, (guess + 1) * cycleYears);
      if (next.getTime() <= today.getTime()) {
        guess++;
        continue;
      }
      break;
    }
    cyclesPassed = Math.max(0, guess);
  }

  const applyIncrementOnce = (current: number) => {
    if (args.incrementType === "AMOUNT") {
      const inc = Number(args.incrementAmount || 0);
      return round2(current + (Number.isFinite(inc) ? inc : 0));
    }
    const rate = Number(args.incrementRatePercent || 0);
    const safeRate = Number.isFinite(rate) ? rate : 0;
    return round2(current + (current * safeRate) / 100);
  };

  let currentRent = round2(baseRent);
  for (let i = 0; i < cyclesPassed; i++) {
    currentRent = applyIncrementOnce(currentRent);
  }

  const nextRent = applyIncrementOnce(currentRent);
  const nextDate = addYearsClampedUTC(start, (cyclesPassed + 1) * cycleYears);

  return { nextDate: formatDateOnlyUTC(nextDate), nextRent };
}

export default function LandlordRentPage() {
  const params = useParams<{ landlord: string }>();
  const router = useRouter();
  const userFromContext = useUser();
  const [user, setUser] = useState<any>(null);
  const landlord = decodeURIComponent(String(params?.landlord || ""));

  const [hoardings, setHoardings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    partyType: "Private",
    rentAmount: "",
    incrementCycleYears: 1,
    incrementRate: 10,
    incrementType: "PERCENTAGE", // PERCENTAGE | AMOUNT
    incrementValue: "", // number as string
    rentStartDate: "",
    paymentFrequency: "Monthly",
    paymentMode: "Cash",
    chequeName: "",
    bankName: "",
    ifsc: "",
    accountNumber: "",
    landlordName: "",
    lastPaymentDate: "",
    reminderDays: [14] as number[],
  });
  const [nextDueDate, setNextDueDate] = useState<string>("");
  const [nextIncrementPreview, setNextIncrementPreview] = useState<{
    nextDate?: string;
    nextRent?: number;
  }>({});

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
    fetchHoardings();
    // Pre-fill landlord name
    setFormData((prev) => ({ ...prev, landlordName: landlord }));
  }, [landlord]);

  // Client-side preview for next increment values when user edits form
  useEffect(() => {
    const preview = calculateNextIncrementPreview({
      rentStartDate: formData.rentStartDate,
      baseRent: Number(formData.rentAmount),
      incrementCycleYears: Number(formData.incrementCycleYears || 1),
      incrementType: formData.incrementType as any,
      incrementRatePercent: Number(formData.incrementRate || 0),
      incrementAmount: Number(formData.incrementValue || 0),
    });
    setNextIncrementPreview(preview);
  }, [
    formData.rentStartDate,
    formData.incrementCycleYears,
    formData.rentAmount,
    formData.incrementType,
    formData.incrementValue,
    formData.incrementRate,
  ]);

  useEffect(() => {
    if (formData.lastPaymentDate && formData.paymentFrequency) {
      const d = new Date(formData.lastPaymentDate);
      switch (formData.paymentFrequency) {
        case "Monthly":
          d.setMonth(d.getMonth() + 1);
          break;
        case "Quarterly":
          d.setMonth(d.getMonth() + 3);
          break;
        case "HalfYearly":
        case "Half-Yearly":
          d.setMonth(d.getMonth() + 6);
          break;
        case "Yearly":
          d.setFullYear(d.getFullYear() + 1);
          break;
      }
      setNextDueDate(d.toISOString().split("T")[0]);
    } else {
      setNextDueDate("");
    }
  }, [formData.lastPaymentDate, formData.paymentFrequency]);

  const fetchHoardings = async () => {
    try {
      setLoading(true);
      // Fetch all hoardings and filter by landlord on client side
      const response = await hoardingsAPI.getAll({
        page: 1,
        limit: 1000,
      });

      if (response.success && response.data) {
        const allHoardings = response.data.hoardings || [];

        // Helper to extract landlord from hoarding
        const getLandlord = (h: any): string => {
          if (h.rateHistory && typeof h.rateHistory === "object") {
            const landlord = (h.rateHistory as any)?.landlord;
            if (landlord && typeof landlord === "string" && landlord.trim()) {
              return landlord.trim();
            }
          }
          if (h.ownership) {
            const ownership = h.ownership.toString();
            const match = ownership.match(
              /^(gov|govt|government)\s*-\s*(.+)$/i
            );
            if (match && match[2]) {
              return match[2].trim();
            }
          }
          return "Unknown";
        };

        // Filter hoardings by landlord
        const landlordHoardings = allHoardings.filter((h: any) => {
          const hLandlord = getLandlord(h);
          return hLandlord === landlord;
        });

        setHoardings(landlordHoardings);
      }
    } catch (error) {
      console.error("Failed to fetch hoardings:", error);
      showError("Failed to load hoardings");
      router.push("/hoardings");
    } finally {
      setLoading(false);
    }
  };

  const toggleReminder = (day: number) => {
    setFormData((prev: any) => {
      const has = prev.reminderDays.includes(day);
      return {
        ...prev,
        reminderDays: has
          ? prev.reminderDays.filter((d: number) => d !== day)
          : [...prev.reminderDays, day],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.rentAmount || !formData.partyType || !formData.paymentMode) {
      showError("Please fill in all required fields");
      return;
    }

    if (hoardings.length === 0) {
      showError("No hoardings found for this landlord");
      return;
    }

    const confirmRent = window.confirm(
      `Are you sure you want to create rent records for all ${hoardings.length} hoarding(s) under "${landlord}"? These hoardings will now be available for bookings.`
    );
    if (!confirmRent) return;

    try {
      setSaving(true);

      // For individual hoarding rent records, we use the fields that the rent API supports
      // Note: The rent API uses paymentMode for frequency (Monthly/Quarterly/etc)
      // Map paymentFrequency to paymentMode format expected by rent API
      const paymentModeForRent =
        formData.paymentFrequency === "HalfYearly"
          ? "Half-Yearly"
          : formData.paymentFrequency;

      const rentData = {
        partyType: formData.partyType,
        rentAmount: (() => {
          const amount = parseFloat(formData.rentAmount);
          return isNaN(amount) ? 0 : Math.round(amount * 100) / 100;
        })(),
        incrementYear: formData.rentStartDate
          ? new Date(formData.rentStartDate).getFullYear() +
            (formData.incrementCycleYears || 1)
          : null,
        paymentMode: paymentModeForRent, // Rent API uses paymentMode for frequency
        lastPaymentDate: formData.lastPaymentDate || null,
      };

      // Create rent records for all hoardings
      const rentPromises = hoardings.map((h) =>
        rentAPI.saveRent(h.id, rentData)
      );

      await Promise.all(rentPromises);

      // Mark all hoardings as "on_rent"
      const updatePromises = hoardings.map((h) =>
        hoardingsAPI.update(h.id, { status: "on_rent" })
      );

      await Promise.all(updatePromises);

      showSuccess(
        `Rent details saved for all ${hoardings.length} hoarding(s) under "${landlord}". These hoardings will now be available for bookings.`
      );
      router.push("/hoardings");
    } catch (error: any) {
      console.error("Error saving rent:", error);
      showError(
        "Error saving rent: " +
          (error.response?.data?.message || "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  };

  // Robust role extraction with fallback
  const extractedRole = getRoleFromUser(user);
  const rawRole = (user as any)?.role || (user as any)?.userRole || "";
  const userRole =
    extractedRole || (typeof rawRole === "string" ? rawRole : "");
  const canEdit = canEditRent(userRole);
  const fallbackRoleLower = (user as any)?.role?.toLowerCase?.() || "";
  const canEditFinal =
    canEdit || ["owner", "manager", "admin"].includes(fallbackRoleLower);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
        <p>Loading hoardings...</p>
      </div>
    );
  }

  if (!canEditFinal) {
    return (
      <div>
        <button
          className="btn btn-secondary"
          onClick={() => router.back()}
          style={{ marginBottom: "16px" }}
        >
          ← Back
        </button>
        <div className="card">
          <p>You don't have permission to create rent records.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <button
          className="btn btn-secondary"
          onClick={() => router.back()}
          style={{ marginBottom: "16px" }}
        >
          ← Back
        </button>
        <h1>Create Rent for Landlord</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
          Landlord: <strong>{landlord}</strong>
        </p>
        <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
          Hoardings: <strong>{hoardings.length}</strong> hoarding(s) will be
          marked as "on rent"
        </p>
      </div>

      {hoardings.length === 0 ? (
        <div className="card">
          <p>No hoardings found for this landlord.</p>
        </div>
      ) : (
        <div className="card">
          <h3>Rent Details</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>
            The rent details you enter below will be applied to all{" "}
            <strong>{hoardings.length}</strong> hoarding(s) under this landlord.
          </p>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "16px",
              }}
            >
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
                  Rent Amount (₹) <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="number"
                  value={formData.rentAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || !isNaN(parseFloat(value))) {
                      setFormData({ ...formData, rentAmount: value });
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value && !isNaN(parseFloat(value))) {
                      const rounded = (
                        Math.round(parseFloat(value) * 100) / 100
                      ).toFixed(2);
                      setFormData({ ...formData, rentAmount: rounded });
                    }
                  }}
                  placeholder="Enter rent amount"
                  required
                  min="0"
                  step="0.01"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label>Increment Type</label>
                <select
                  value={formData.incrementType}
                  onChange={(e) =>
                    setFormData({ ...formData, incrementType: e.target.value })
                  }
                  disabled={saving}
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="AMOUNT">Fixed Amount</option>
                </select>
              </div>

              <div className="form-group">
                <label>Increment Cycle (years)</label>
                <select
                  value={formData.incrementCycleYears}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      incrementCycleYears: Number(e.target.value),
                    })
                  }
                  disabled={saving}
                >
                  <option value={1}>Every 1 year</option>
                  <option value={2}>Every 2 years</option>
                  <option value={3}>Every 3 years</option>
                </select>
              </div>

              <div className="form-group">
                {formData.incrementType === "PERCENTAGE" ? (
                  <>
                    <label>Increment Rate (%)</label>
                    <input
                      type="number"
                      value={formData.incrementRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          incrementRate: Number(e.target.value),
                        })
                      }
                      min={0}
                      step={0.1}
                      disabled={saving}
                    />
                  </>
                ) : (
                  <>
                    <label>Increment Amount (₹)</label>
                    <input
                      type="number"
                      value={formData.incrementValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          incrementValue: e.target.value,
                        })
                      }
                      min={0}
                      step={1}
                      disabled={saving}
                    />
                  </>
                )}
              </div>

              <div className="form-group">
                <label>Rent Start Date</label>
                <input
                  type="date"
                  value={formData.rentStartDate}
                  onChange={(e) =>
                    setFormData({ ...formData, rentStartDate: e.target.value })
                  }
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label>
                  Payment Frequency <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  value={formData.paymentFrequency}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paymentFrequency: e.target.value,
                    })
                  }
                  required
                  disabled={saving}
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="HalfYearly">Half-Yearly</option>
                  <option value="Yearly">Yearly</option>
                </select>
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
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online</option>
                </select>
              </div>

              {formData.paymentMode === "Cheque" && (
                <div className="form-group">
                  <label>Cheque issued to (name)</label>
                  <input
                    type="text"
                    value={formData.chequeName}
                    onChange={(e) =>
                      setFormData({ ...formData, chequeName: e.target.value })
                    }
                    disabled={saving}
                  />
                </div>
              )}

              {formData.paymentMode === "Online" && (
                <>
                  <div className="form-group">
                    <label>Bank Name</label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) =>
                        setFormData({ ...formData, bankName: e.target.value })
                      }
                      disabled={saving}
                    />
                  </div>
                  <div className="form-group">
                    <label>IFSC</label>
                    <input
                      type="text"
                      value={formData.ifsc}
                      onChange={(e) =>
                        setFormData({ ...formData, ifsc: e.target.value })
                      }
                      disabled={saving}
                    />
                  </div>
                  <div className="form-group">
                    <label>Account Number</label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          accountNumber: e.target.value,
                        })
                      }
                      disabled={saving}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Landlord</label>
                <input
                  type="text"
                  value={formData.landlordName}
                  onChange={(e) =>
                    setFormData({ ...formData, landlordName: e.target.value })
                  }
                  placeholder="Owner / Landlord name"
                  disabled={saving}
                />
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

              <div className="form-group">
                <label>Next Due Date</label>
                <input
                  type="date"
                  value={nextDueDate}
                  disabled
                  style={{ background: "#f8fafc" }}
                />
              </div>

              <div className="form-group">
                <label>Next Increment Preview</label>
                <div className="card" style={{ padding: "8px" }}>
                  <div>
                    Next Increment On: {nextIncrementPreview.nextDate || "--"}
                  </div>
                  <div>
                    Expected Next Rent:{" "}
                    {nextIncrementPreview.nextRent != null
                      ? `₹${nextIncrementPreview.nextRent.toLocaleString()}`
                      : "--"}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Reminder Settings</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[7, 14, 30].map((d) => (
                    <label key={d} style={{ fontSize: "12px" }}>
                      <input
                        type="checkbox"
                        checked={formData.reminderDays.includes(d)}
                        onChange={() => toggleReminder(d)}
                        style={{ marginRight: "4px" }}
                        disabled={saving}
                      />
                      {d} days before
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : `Save Rent for ${hoardings.length} Hoarding(s)`}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
