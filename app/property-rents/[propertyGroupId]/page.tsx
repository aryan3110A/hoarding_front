"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { propertyRentAPI, hoardingsAPI } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/components/AppLayout";
import { getRoleFromUser, canViewRent } from "@/lib/rbac";

export default function PropertyRentPage() {
  const params = useParams<{ propertyGroupId: string }>();
  const propertyGroupId = decodeURIComponent(
    String(params?.propertyGroupId || ""),
  );
  const router = useRouter();
  const user = useUser();
  const role = getRoleFromUser(user);
  const allowed = canViewRent(role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<any>({
    propertyGroupId,
    location: "",
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

  useEffect(() => {
    const load = async () => {
      let locationName = "";
      let group: any[] = [];
      try {
        const hoardingsRes = await hoardingsAPI.getAll({ page: 1, limit: 200 });
        if (hoardingsRes.success && hoardingsRes.data) {
          const hoardings = hoardingsRes.data.hoardings || [];
          group = hoardings.filter((h: any) => {
            if (h.propertyGroupId) return h.propertyGroupId === propertyGroupId;
            const code = h.code || "";
            const parts = code.split("-");
            if (parts.length >= 2)
              return parts.slice(0, 2).join("-") === propertyGroupId;
            return false;
          });
          if (group.length > 0) {
            locationName = [group[0].city, group[0].area]
              .filter(Boolean)
              .join(", ");
          }
        }

        const res = await propertyRentAPI.get(propertyGroupId);
        if (res.success && res.data) {
          const r = res.data;
          setExists(true);

          const landlordFromRent =
            (r as any).landlordName || (r as any).landlord || "";
          const landlordFromGroup =
            group && group.length
              ? group
                  .map(
                    (h: any) =>
                      (h.rateHistory && h.rateHistory.landlord) ||
                      h.landlord ||
                      null,
                  )
                  .find(Boolean) || ""
              : "";

          setForm({
            propertyGroupId: r.propertyGroupId,
            location: r.location || locationName,
            rentAmount: String(r.rentAmount || ""),
            incrementCycleYears: r.incrementCycleYears || 1,
            incrementRate: r.incrementRate ? Number(r.incrementRate) * 100 : 10,
            incrementType: (r as any).incrementType || "PERCENTAGE",
            incrementValue: (r as any).incrementValue
              ? String((r as any).incrementValue)
              : "",
            rentStartDate: r.rentStartDate ? r.rentStartDate.split("T")[0] : "",
            paymentMode: (r as any).paymentMode || "Cash",
            chequeName: (r as any).chequeName || "",
            bankName: (r as any).bankName || "",
            ifsc: (r as any).ifsc || "",
            accountNumber: (r as any).accountNumber || "",
            landlordName: landlordFromRent || landlordFromGroup || "",
            paymentFrequency: r.paymentFrequency || "Monthly",
            lastPaymentDate: r.lastPaymentDate
              ? r.lastPaymentDate.split("T")[0]
              : "",
            reminderDays: r.reminderDays || [14],
          });

          if (r.nextDueDate) setNextDueDate(r.nextDueDate.split("T")[0]);
          if ((r as any).nextIncrementDate && r.baseRent) {
            const nextDate = (r as any).nextIncrementDate.split("T")[0];
            // Preview next rent on client using current rule
            const current = Number(r.baseRent || r.rentAmount || 0);
            const type = (r as any).incrementType || "PERCENTAGE";
            const incVal = Number((r as any).incrementValue || 0);
            const nextRent =
              type === "PERCENTAGE"
                ? current + (current * incVal) / 100
                : current + incVal;
            setNextIncrementPreview({ nextDate, nextRent });
          }
        } else {
          const landlordFromGroup =
            group && group.length
              ? group
                  .map(
                    (h: any) =>
                      (h.rateHistory && h.rateHistory.landlord) ||
                      h.landlord ||
                      null,
                  )
                  .find(Boolean) || ""
              : "";
          setForm((prev: any) => ({
            ...prev,
            location: locationName,
            landlordName: landlordFromGroup,
          }));
        }
      } catch (err) {
        setForm((prev: any) => ({ ...prev, location: locationName }));
      } finally {
        setLoading(false);
      }
    };

    if (propertyGroupId) load();
  }, [propertyGroupId]);
  // Client-side preview for next increment values when user edits form
  useEffect(() => {
    if (form.rentStartDate && form.incrementCycleYears) {
      const next = new Date(form.rentStartDate);
      next.setFullYear(
        next.getFullYear() + Number(form.incrementCycleYears || 1),
      );
      const nextDate = next.toISOString().split("T")[0];
      const current = Number(form.rentAmount || 0);
      const incVal = Number(form.incrementValue || form.incrementRate); // fallback to rate if value empty
      const nextRent =
        form.incrementType === "AMOUNT"
          ? current + incVal
          : current + (current * incVal) / 100;
      setNextIncrementPreview({ nextDate, nextRent });
    } else {
      setNextIncrementPreview({});
    }
  }, [
    form.rentStartDate,
    form.incrementCycleYears,
    form.rentAmount,
    form.incrementType,
    form.incrementValue,
    form.incrementRate,
  ]);

  useEffect(() => {
    if (form.rentStartDate && form.paymentFrequency) {
      const d = new Date(form.rentStartDate);
      switch (form.paymentFrequency) {
        case "Monthly":
          d.setMonth(d.getMonth() + 1);
          break;
        case "Quarterly":
          d.setMonth(d.getMonth() + 3);
          break;
        case "HalfYearly":
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
  }, [form.rentStartDate, form.paymentFrequency]);

  const toggleReminder = (day: number) => {
    setForm((prev: any) => {
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
    setError("");
    setSaving(true);
    try {
      const payload: any = {
        propertyGroupId: form.propertyGroupId,
        landlordName: (form.landlordName || "Unknown").trim(),
        location: form.location,
        rentAmount: form.rentAmount ? Number(form.rentAmount) : 0,
        incrementCycleYears: form.incrementCycleYears,
        // New increment fields
        incrementType: form.incrementType,
        incrementValue:
          form.incrementValue !== ""
            ? Number(form.incrementValue)
            : Number(form.incrementRate),
        rentStartDate: form.rentStartDate || undefined,
        paymentFrequency: form.paymentFrequency,
        lastPaymentDate: form.lastPaymentDate || undefined,
        reminderDays: form.reminderDays,
        paymentMode: form.paymentMode,
      };

      if (form.landlordName) payload.landlordName = form.landlordName;

      if (form.paymentMode === "Cheque")
        payload.chequeName = form.chequeName || undefined;
      else if (form.paymentMode === "Online") {
        payload.bankName = form.bankName || undefined;
        payload.ifsc = form.ifsc || undefined;
        payload.accountNumber = form.accountNumber || undefined;
      }

      const res = await propertyRentAPI.save(payload);
      if (res.success) router.push("/hoardings");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to save property rent",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!allowed)
    return (
      <ProtectedRoute component="hoardings">
        <div />
      </ProtectedRoute>
    );

  return (
    <ProtectedRoute component="hoardings">
      <div>
        <div
          style={{
            marginBottom: "16px",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/hoardings")}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0 }}>Property Rent</h1>
        </div>
        <p style={{ color: "rgba(255,255,255,0.8)", marginTop: "0px" }}>
          {exists
            ? "Update rent details for this property group."
            : "Create rent record for this property group."}
        </p>
        {error && (
          <div
            className="card"
            style={{ marginBottom: "16px", color: "#dc2626" }}
          >
            {error}
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
            <p>Loading...</p>
          </div>
        ) : (
          <div className="card">
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "16px",
                }}
              >
                <div className="form-group">
                  <label>Property Group ID *</label>
                  <input type="text" value={form.propertyGroupId} disabled />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="e.g. ABC Road"
                  />
                </div>
                <div className="form-group">
                  <label>Rent Amount (₹)</label>
                  <input
                    type="number"
                    value={form.rentAmount}
                    onChange={(e) =>
                      setForm({ ...form, rentAmount: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Increment Cycle (years)</label>
                  <select
                    value={form.incrementCycleYears}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        incrementCycleYears: Number(e.target.value),
                      })
                    }
                  >
                    <option value={1}>Every 1 year</option>
                    <option value={2}>Every 2 years</option>
                    <option value={3}>Every 3 years</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Increment Type</label>
                  <select
                    value={form.incrementType}
                    onChange={(e) =>
                      setForm({ ...form, incrementType: e.target.value })
                    }
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="AMOUNT">Fixed Amount</option>
                  </select>
                </div>
                <div className="form-group">
                  {form.incrementType === "PERCENTAGE" ? (
                    <>
                      <label>Increment Rate (%)</label>
                      <input
                        type="number"
                        value={form.incrementRate}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            incrementRate: Number(e.target.value),
                          })
                        }
                        min={0}
                        step={0.1}
                      />
                    </>
                  ) : (
                    <>
                      <label>Increment Amount (₹)</label>
                      <input
                        type="number"
                        value={form.incrementValue}
                        onChange={(e) =>
                          setForm({ ...form, incrementValue: e.target.value })
                        }
                        min={0}
                        step={1}
                      />
                    </>
                  )}
                </div>
                <div className="form-group">
                  <label>Rent Start Date</label>
                  <input
                    type="date"
                    value={form.rentStartDate}
                    onChange={(e) =>
                      setForm({ ...form, rentStartDate: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Payment Frequency</label>
                  <select
                    value={form.paymentFrequency}
                    onChange={(e) =>
                      setForm({ ...form, paymentFrequency: e.target.value })
                    }
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="HalfYearly">Half-Yearly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Payment Mode</label>
                  <select
                    value={form.paymentMode}
                    onChange={(e) =>
                      setForm({ ...form, paymentMode: e.target.value })
                    }
                  >
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                  </select>
                </div>

                {form.paymentMode === "Cheque" && (
                  <div className="form-group">
                    <label>Cheque issued to (name)</label>
                    <input
                      type="text"
                      value={form.chequeName}
                      onChange={(e) =>
                        setForm({ ...form, chequeName: e.target.value })
                      }
                    />
                  </div>
                )}

                {form.paymentMode === "Online" && (
                  <>
                    <div className="form-group">
                      <label>Bank Name</label>
                      <input
                        type="text"
                        value={form.bankName}
                        onChange={(e) =>
                          setForm({ ...form, bankName: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>IFSC</label>
                      <input
                        type="text"
                        value={form.ifsc}
                        onChange={(e) =>
                          setForm({ ...form, ifsc: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Account Number</label>
                      <input
                        type="text"
                        value={form.accountNumber}
                        onChange={(e) =>
                          setForm({ ...form, accountNumber: e.target.value })
                        }
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Landlord</label>
                  <input
                    type="text"
                    value={form.landlordName}
                    onChange={(e) =>
                      setForm({ ...form, landlordName: e.target.value })
                    }
                    placeholder="Owner / Landlord name"
                  />
                </div>

                <div className="form-group">
                  <label>Last Payment Date</label>
                  <input
                    type="date"
                    value={form.lastPaymentDate}
                    onChange={(e) =>
                      setForm({ ...form, lastPaymentDate: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Next Due Date</label>
                  <input type="date" value={nextDueDate} disabled />
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
                        ? nextIncrementPreview.nextRent
                        : "--"}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Reminder Settings</label>
                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    {[7, 14, 30].map((d) => (
                      <label key={d} style={{ fontSize: "12px" }}>
                        <input
                          type="checkbox"
                          checked={form.reminderDays.includes(d)}
                          onChange={() => toggleReminder(d)}
                          style={{ marginRight: "4px" }}
                        />
                        {d} days before
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : exists
                      ? "Update Rent"
                      : "Create Rent"}
                </button>
                <Link href="/hoardings" className="btn btn-secondary">
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
