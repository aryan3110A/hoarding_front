"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { hoardingsAPI, propertyRentAPI } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/components/AppLayout";
import { canEditRent, getRoleFromUser } from "@/lib/rbac";
import { showError, showSuccess } from "@/lib/toast";

type Frequency = "Monthly" | "Quarterly" | "HalfYearly" | "Yearly";

function addMonthsClamped(base: Date, months: number) {
  const next = new Date(base);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) next.setDate(0);
  return next;
}

function nextDueFromStart(startDate: string, frequency: Frequency) {
  if (!startDate) return "";
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return "";

  const months =
    frequency === "Monthly"
      ? 1
      : frequency === "Quarterly"
        ? 3
        : frequency === "HalfYearly"
          ? 6
          : 12;

  let due = addMonthsClamped(start, months);
  const now = new Date();
  while (due.getTime() <= now.getTime()) {
    due = addMonthsClamped(due, months);
  }

  return due.toISOString().split("T")[0];
}

function extractLandlordName(hoarding: any) {
  const history =
    hoarding?.rateHistory && typeof hoarding.rateHistory === "object"
      ? hoarding.rateHistory
      : {};
  const fromHistory =
    (history as any)?.landlordName || (history as any)?.landlord || "";
  if (String(fromHistory).trim()) return String(fromHistory).trim();

  const ownership = String(hoarding?.ownership || "");
  const match = ownership.match(/^(gov|govt|government)\s*-\s*(.+)$/i);
  if (match && match[2]) return String(match[2]).trim();

  return "Unknown";
}

export default function LandlordRentPage() {
  const params = useParams<{ landlord: string }>();
  const landlordName = decodeURIComponent(
    String(params?.landlord || ""),
  ).trim();
  const router = useRouter();
  const user = useUser();
  const role = getRoleFromUser(user);
  const canEdit = canEditRent(role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hoardingCount, setHoardingCount] = useState(0);
  const [form, setForm] = useState({
    landlordName,
    location: "",
    rentAmount: "",
    incrementCycleYears: 1,
    incrementType: "PERCENTAGE",
    incrementValue: "10",
    rentStartDate: "",
    paymentFrequency: "Monthly" as Frequency,
    lastPaymentDate: "",
    reminderDays: [14] as number[],
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const hoardingRes = await hoardingsAPI.getAll({ page: 1, limit: 2000 });

        if (hoardingRes?.success) {
          const all = hoardingRes.data?.hoardings || [];
          const matched = all.filter(
            (h: any) =>
              extractLandlordName(h).toLowerCase() ===
              landlordName.toLowerCase(),
          );
          setHoardingCount(matched.length);

          if (matched.length > 0) {
            const loc = [matched[0].city, matched[0].area]
              .filter(Boolean)
              .join(", ");
            if (loc) {
              setForm((prev) => ({ ...prev, location: prev.location || loc }));
            }
          }
        }

        try {
          const landlordRentRes =
            await propertyRentAPI.getByLandlord(landlordName);
          if (landlordRentRes?.success && landlordRentRes.data) {
            const data = landlordRentRes.data;
            setForm((prev) => ({
              ...prev,
              landlordName,
              location: data.location || prev.location || "",
              rentAmount: String(data.rentAmount || ""),
              incrementCycleYears: Number(data.incrementCycleYears || 1),
              incrementType: String(data.incrementType || "PERCENTAGE"),
              incrementValue: data.incrementValue
                ? String(data.incrementValue)
                : prev.incrementValue,
              rentStartDate: data.rentStartDate
                ? String(data.rentStartDate).split("T")[0]
                : "",
              paymentFrequency: (data.paymentFrequency ||
                "Monthly") as Frequency,
              lastPaymentDate: data.lastPaymentDate
                ? String(data.lastPaymentDate).split("T")[0]
                : "",
              reminderDays:
                Array.isArray(data.reminderDays) && data.reminderDays.length
                  ? data.reminderDays
                  : [14],
            }));
          }
        } catch (rentError: any) {
          const message = String(
            rentError?.response?.data?.message || rentError?.message || "",
          ).toLowerCase();
          const status = Number(rentError?.response?.status || 0);
          const isNotFound = status === 404 || message.includes("not found");
          if (!isNotFound) {
            showError(
              rentError?.response?.data?.message ||
                "Failed to load landlord rent data",
            );
          }
        }
      } catch (error: any) {
        showError(
          error?.response?.data?.message || "Failed to load landlord rent data",
        );
      } finally {
        setLoading(false);
      }
    };

    if (landlordName) load();
  }, [landlordName]);

  const nextDueDate = useMemo(
    () => nextDueFromStart(form.rentStartDate, form.paymentFrequency),
    [form.rentStartDate, form.paymentFrequency],
  );

  const toggleReminder = (day: number) => {
    setForm((prev) => {
      const has = prev.reminderDays.includes(day);
      return {
        ...prev,
        reminderDays: has
          ? prev.reminderDays.filter((d) => d !== day)
          : [...prev.reminderDays, day],
      };
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.rentAmount || !form.rentStartDate) {
      showError("Rent amount and rent start date are required");
      return;
    }

    try {
      setSaving(true);
      await propertyRentAPI.save({
        landlordName,
        location: form.location || undefined,
        rentAmount: Number(form.rentAmount),
        incrementCycleYears: Number(form.incrementCycleYears || 1),
        incrementType: form.incrementType,
        incrementValue: Number(form.incrementValue || 0),
        rentStartDate: form.rentStartDate,
        paymentFrequency: form.paymentFrequency,
        lastPaymentDate: form.lastPaymentDate || undefined,
        reminderDays: form.reminderDays,
      });

      showSuccess("Landlord rent saved successfully");
      router.push("/hoardings");
    } catch (error: any) {
      showError(
        error?.response?.data?.message || "Failed to save landlord rent",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute component="hoardings">
      <div>
        <div
          style={{
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/hoardings")}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0 }}>Landlord Rent Editor</h1>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
            <p>Loading landlord rent...</p>
          </div>
        ) : (
          <div className="card">
            <div style={{ marginBottom: "16px" }}>
              <strong>Landlord:</strong> {landlordName || "N/A"}
              <br />
              <strong>Linked hoardings:</strong> {hoardingCount}
            </div>

            <form onSubmit={onSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "16px",
                }}
              >
                <div className="form-group">
                  <label>Landlord Name</label>
                  <input value={landlordName} disabled />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input
                    value={form.location}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, location: e.target.value }))
                    }
                    placeholder="City / Area"
                  />
                </div>
                <div className="form-group">
                  <label>Rent Amount (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.rentAmount}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, rentAmount: e.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Payment Frequency *</label>
                  <select
                    value={form.paymentFrequency}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        paymentFrequency: e.target.value as Frequency,
                      }))
                    }
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="HalfYearly">Half Yearly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Rent Start Date *</label>
                  <input
                    type="date"
                    required
                    value={form.rentStartDate}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, rentStartDate: e.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Last Payment Date (history only)</label>
                  <input
                    type="date"
                    value={form.lastPaymentDate}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        lastPaymentDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Increment Cycle (Years)</label>
                  <select
                    value={form.incrementCycleYears}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        incrementCycleYears: Number(e.target.value),
                      }))
                    }
                  >
                    <option value={1}>1 year</option>
                    <option value={2}>2 years</option>
                    <option value={3}>3 years</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Increment Type</label>
                  <select
                    value={form.incrementType}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, incrementType: e.target.value }))
                    }
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="AMOUNT">Amount</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>
                    {form.incrementType === "AMOUNT"
                      ? "Increment Amount (₹)"
                      : "Increment Value (%)"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.incrementValue}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, incrementValue: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "8px" }}>
                <label>Reminder Days</label>
                <div style={{ display: "flex", gap: "12px" }}>
                  {[7, 14, 30].map((day) => (
                    <label
                      key={day}
                      style={{ display: "inline-flex", gap: "6px" }}
                    >
                      <input
                        type="checkbox"
                        checked={form.reminderDays.includes(day)}
                        onChange={() => toggleReminder(day)}
                      />
                      {day} days
                    </label>
                  ))}
                </div>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "var(--bg-primary, #f8fafc)",
                }}
              >
                <strong>Next Due Date (Fixed Cycle):</strong>{" "}
                {nextDueDate || "N/A"}
                <div
                  style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                >
                  Derived from Rent Start Date + Cycle. Late payments do not
                  shift schedule.
                </div>
              </div>

              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                {canEdit ? (
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Landlord Rent"}
                  </button>
                ) : (
                  <button className="btn btn-secondary" type="button" disabled>
                    View Only
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => router.push("/hoardings")}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
