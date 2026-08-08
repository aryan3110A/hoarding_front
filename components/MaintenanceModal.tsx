"use client";

import { useEffect, useMemo, useState } from "react";
import { maintenanceAPI, hoardingsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

const FALLBACK_TYPES = [
  { value: "LAKDANI_PATTI", label: "Lakdani Patti / Patti Badalvi" },
  { value: "WIRING", label: "Wiring" },
  { value: "CHANGED_BANNER", label: "Changed Banner" },
  { value: "CONTACT_NUMBER", label: "Contact Number Lagavano" },
  { value: "OTHER", label: "Other" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  initialHoardingId?: string;
  onSaved?: () => void;
};

export default function MaintenanceModal({
  open,
  onClose,
  initialHoardingId,
  onSaved,
}: Props) {
  const [types, setTypes] = useState(FALLBACK_TYPES);
  const [hoardings, setHoardings] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    hoardingId: initialHoardingId || "",
    maintenanceType: "LAKDANI_PATTI",
    maintenanceDate: new Date().toISOString().slice(0, 10),
    performedBy: "",
    remarks: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      hoardingId: initialHoardingId || prev.hoardingId,
      maintenanceDate: new Date().toISOString().slice(0, 10),
    }));
    (async () => {
      try {
        const [typeRes, listRes] = await Promise.all([
          maintenanceAPI.types(),
          hoardingsAPI.getAll({ limit: 200 }),
        ]);
        const t = Array.isArray(typeRes?.data) ? typeRes.data : FALLBACK_TYPES;
        setTypes(t);
        const rows = listRes?.data?.hoardings || listRes?.data || [];
        setHoardings(Array.isArray(rows) ? rows : []);
      } catch {
        setTypes(FALLBACK_TYPES);
      }
    })();
  }, [open, initialHoardingId]);

  useEffect(() => {
    if (!open || !form.hoardingId) {
      setHistory([]);
      return;
    }
    (async () => {
      try {
        const res = await maintenanceAPI.listByHoarding(form.hoardingId);
        setHistory(Array.isArray(res?.data) ? res.data : []);
      } catch {
        setHistory([]);
      }
    })();
  }, [open, form.hoardingId]);

  const selected = useMemo(
    () => hoardings.find((h) => h.id === form.hoardingId) || null,
    [hoardings, form.hoardingId],
  );

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hoardingId) return showError("Select a hoarding");
    if (!form.performedBy.trim()) return showError("Enter person who performed maintenance");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("hoardingId", form.hoardingId);
      fd.append("maintenanceType", form.maintenanceType);
      fd.append("maintenanceDate", form.maintenanceDate);
      fd.append("performedBy", form.performedBy.trim());
      if (form.remarks.trim()) fd.append("remarks", form.remarks.trim());
      if (photo) fd.append("photo", photo);
      await maintenanceAPI.create(fd);
      showSuccess("Maintenance recorded (status unchanged)");
      onSaved?.();
      const res = await maintenanceAPI.listByHoarding(form.hoardingId);
      setHistory(Array.isArray(res?.data) ? res.data : []);
      setPhoto(null);
      setForm((prev) => ({ ...prev, remarks: "", performedBy: "" }));
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to save maintenance");
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = (value: string) =>
    types.find((t) => t.value === value)?.label || value;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 text-slate-900 border border-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Record Maintenance</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Side record only — does not change availability, live, blocked, booked, mounting or unmounting status.
        </p>

        <form onSubmit={submit} className="grid gap-3">
          <div className="form-group" style={{ margin: 0 }}>
            <label>Hoarding *</label>
            <select
              value={form.hoardingId}
              onChange={(e) => setForm((p) => ({ ...p, hoardingId: e.target.value }))}
              required
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select hoarding</option>
              {hoardings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.code} {h.city ? `• ${h.city}` : ""} {h.landmark ? `• ${h.landmark}` : ""}
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <div className="text-xs bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-2">
              <div>Code: <strong>{selected.code}</strong></div>
              <div>City: <strong>{selected.city || "—"}</strong></div>
              <div className="col-span-2">
                Landmark: <strong>{selected.landmark || selected.area || "—"}</strong>
              </div>
              <div>Status (unchanged): <strong>{selected.status || "—"}</strong></div>
            </div>
          ) : null}

          <div className="form-group" style={{ margin: 0 }}>
            <label>Maintenance Type *</label>
            <select
              value={form.maintenanceType}
              onChange={(e) => setForm((p) => ({ ...p, maintenanceType: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Maintenance Date *</label>
              <input
                type="date"
                value={form.maintenanceDate}
                onChange={(e) => setForm((p) => ({ ...p, maintenanceDate: e.target.value }))}
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Performed By *</label>
              <input
                type="text"
                value={form.performedBy}
                onChange={(e) => setForm((p) => ({ ...p, performedBy: e.target.value }))}
                required
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Person name"
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Remarks</label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
              rows={3}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Maintenance"}
          </button>
        </form>

        <div className="mt-5">
          <h3 className="font-semibold mb-2">Maintenance History</h3>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No maintenance records yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((row) => (
                <div key={row.id} className="border rounded-lg p-3 text-sm">
                  <div className="font-medium">{typeLabel(row.maintenanceType)}</div>
                  <div className="text-slate-600">
                    {String(row.maintenanceDate || "").slice(0, 10)} • {row.performedBy}
                  </div>
                  {row.remarks ? <div className="mt-1">{row.remarks}</div> : null}
                  {row.photoUrl ? (
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${row.photoUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 underline text-xs"
                    >
                      View photo
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
