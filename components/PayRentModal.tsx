"use client";

import { useEffect, useState } from "react";
import { propertyRentAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

type RentRow = {
  id: string;
  propertyGroupId?: string;
  landlord?: string | null;
  rentAmount?: number;
  currentDueAmount?: number;
  paidAmount?: number;
  nextDueDate?: string | null;
  paymentFrequency?: string;
  paymentStatus?: string;
  overdueDays?: number;
  location?: string | null;
};

type Props = {
  open: boolean;
  rent: RentRow | null;
  onClose: () => void;
  onPaid?: () => void;
};

export default function PayRentModal({ open, rent, onClose, onPaid }: Props) {
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [remarks, setRemarks] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !rent) return;
    const due = Number(rent.currentDueAmount ?? rent.rentAmount ?? 0);
    setAmountPaid(due > 0 ? String(due) : "");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMode("Cash");
    setRemarks("");
    setScreenshot(null);
  }, [open, rent]);

  if (!open || !rent) return null;

  const dueDate = rent.nextDueDate
    ? String(rent.nextDueDate).slice(0, 10)
    : "—";
  const rentDue = Number(rent.currentDueAmount ?? rent.rentAmount ?? 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountPaid);
    if (!Number.isFinite(amount) || amount <= 0) {
      showError("Enter a valid amount being paid");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("propertyRentId", rent.id);
      fd.append("amountPaid", String(amount));
      fd.append("paymentDate", paymentDate);
      fd.append("paymentMode", paymentMode);
      if (remarks.trim()) fd.append("remarks", remarks.trim());
      if (screenshot) fd.append("screenshot", screenshot);
      const res = await propertyRentAPI.pay(fd);
      const fullyPaid = !!res?.data?.fullyPaid;
      showSuccess(
        fullyPaid
          ? "Rent marked Paid. Next due date advanced."
          : "Partial payment recorded. Cycle still pending.",
      );
      onPaid?.();
      onClose();
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-5 text-slate-900 border border-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Pay Rent</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="text-sm bg-slate-50 rounded-xl p-3 mb-4 grid grid-cols-2 gap-2">
          <div>
            Landlord: <strong>{rent.landlord || "—"}</strong>
          </div>
          <div>
            Due date: <strong>{dueDate}</strong>
          </div>
          <div>
            Rent due: <strong>₹{rentDue.toLocaleString("en-IN")}</strong>
          </div>
          <div>
            Status: <strong>{rent.paymentStatus || "—"}</strong>
          </div>
          {Number(rent.overdueDays || 0) > 0 ? (
            <div className="col-span-2 text-amber-700 font-semibold">
              Overdue by {rent.overdueDays} day(s)
            </div>
          ) : null}
        </div>

        <form onSubmit={submit} className="grid gap-3">
          <div className="form-group" style={{ margin: 0 }}>
            <label>Amount being paid *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Payment date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Payment mode *</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              <option value="Cash">Cash</option>
              <option value="Online">Online</option>
              <option value="Cheque">Cheque</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              rows={2}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Payment screenshot / receipt</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Submit Payment"}
          </button>
        </form>
      </div>
    </div>
  );
}
