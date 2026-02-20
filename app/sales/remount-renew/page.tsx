"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { hoardingsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";
import { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";

type Row = {
  id: string;
  tokenId: string;
  hoardingCode: string;
  clientName: string;
  clientPhone: string;
  location: string;
  currentStatus: string;
  remountStatus: "PENDING" | "COMPLETED" | null;
  remountRequestedAt: string | null;
  remountCompletedAt: string | null;
  minimumRate: string | number | null;
  finalRate: string | number | null;
  expiryDate: string | null;
  lastRenewedAt: string | null;
  statusTag: string;
};

type RenewalHistory = {
  id: string;
  previousExpiryDate: string | null;
  newExpiryDate: string;
  renewedByName: string | null;
  renewedAt: string;
  newAmount: string | number;
  tenure: number;
  remountRequired: boolean;
};

const ALLOWED = ["sales", "owner", "manager", "admin", "supervisor"];

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const fmtDateTime = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

export default function SalesRemountRenewPage() {
  const user = useUser();
  const searchParams = useSearchParams();
  const role = String(user?.role || "").toLowerCase();

  const [tab, setTab] = useState<"remount" | "renew">("remount");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [tenure, setTenure] = useState<number>(1);
  const [newAmount, setNewAmount] = useState<string>("");
  const [remountRequired, setRemountRequired] = useState<boolean>(false);

  const [historyByHoarding, setHistoryByHoarding] = useState<
    Record<string, RenewalHistory[]>
  >({});

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await hoardingsAPI.listRemountRenew();
      const payload = resp?.data ?? [];
      setRows(Array.isArray(payload) ? payload : []);
    } catch (e: any) {
      setRows([]);
      showError(e?.response?.data?.message || "Failed to load remount/renew data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchRows();
  }, [user, fetchRows]);

  useEffect(() => {
    const tabParam = String(searchParams?.get("tab") || "").toLowerCase();
    if (tabParam === "renew") setTab("renew");
    if (tabParam === "remount") setTab("remount");
  }, [searchParams]);

  useEffect(() => {
    const id = String(searchParams?.get("hoardingId") || "").trim();
    if (!id || !rows.length) return;
    const match = rows.find((r) => String(r.id) === id);
    if (match && String(searchParams?.get("tab") || "").toLowerCase() === "renew") {
      setSelected(match);
      setTenure(1);
      setNewAmount("");
      setRemountRequired(false);
      setModalOpen(true);
    }
  }, [rows, searchParams]);

  const remountRows = useMemo(
    () => rows.filter((r) => ["live", "booked", "under_process"].includes(String(r.currentStatus || "").toLowerCase())),
    [rows],
  );

  const renewRows = useMemo(
    () => rows.filter((r) => ["live", "booked"].includes(String(r.currentStatus || "").toLowerCase())),
    [rows],
  );

  const openRenewModal = (row: Row) => {
    setSelected(row);
    setTenure(1);
    setNewAmount("");
    setRemountRequired(false);
    setModalOpen(true);
  };

  const loadHistory = async (hoardingId: string) => {
    if (historyByHoarding[hoardingId]) return;
    try {
      const resp = await hoardingsAPI.getRenewalHistory(hoardingId);
      const payload = resp?.data ?? [];
      setHistoryByHoarding((prev) => ({
        ...prev,
        [hoardingId]: Array.isArray(payload) ? payload : [],
      }));
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to load renewal history");
    }
  };

  const markRemount = async (row: Row) => {
    try {
      setBusyId(row.id);
      await hoardingsAPI.requestRemount(row.id);
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                remountStatus: "PENDING",
                remountRequestedAt: new Date().toISOString(),
                statusTag: "LIVE + REMOUNT PENDING",
              }
            : r,
        ),
      );
      showSuccess("Remount marked as pending");
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to mark remount");
    } finally {
      setBusyId(null);
    }
  };

  const submitRenew = async () => {
    if (!selected) return;
    const amount = Number(newAmount || 0);
    const minimum = Number(selected.minimumRate || 0);
    if (!Number.isFinite(tenure) || tenure <= 0) {
      showError("Please enter a valid tenure");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showError("Please enter a valid amount");
      return;
    }
    if (amount < minimum) {
      showError(`Amount cannot be below minimum rate (₹${minimum})`);
      return;
    }

    try {
      setBusyId(selected.id);
      const resp = await hoardingsAPI.renew(selected.id, {
        tenure,
        newAmount: amount,
        remountRequired,
      });
      const payload = resp?.data ?? {};
      setRows((prev) =>
        prev.map((r) =>
          r.id === selected.id
            ? {
                ...r,
                finalRate: amount,
                expiryDate: payload?.newExpiryDate || r.expiryDate,
                lastRenewedAt: new Date().toISOString(),
                remountStatus: remountRequired ? "PENDING" : r.remountStatus,
                remountRequestedAt: remountRequired
                  ? new Date().toISOString()
                  : r.remountRequestedAt,
                statusTag: remountRequired ? "LIVE + REMOUNT PENDING" : "LIVE (Renewed)",
              }
            : r,
        ),
      );
      setModalOpen(false);
      showSuccess(remountRequired ? "Renewed and remount requested" : "Hoarding renewed");
      await loadHistory(selected.id);
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to renew hoarding");
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return <div style={{ textAlign: "center", padding: 24 }}>Loading...</div>;
  if (!ALLOWED.includes(role)) return <AccessDenied />;

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Sales → Remount / Renew</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
        Operational extension of Live hoarding flow with remount and renewal actions.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button
          className={tab === "remount" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setTab("remount")}
        >
          Remount Requests
        </button>
        <button
          className={tab === "renew" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setTab("renew")}
        >
          Extend / Renew Hoarding
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 30 }}>Loading...</div>
        ) : tab === "remount" ? (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th>Hoarding Code</th>
                  <th>Client Name</th>
                  <th>Location</th>
                  <th>Current Status</th>
                  <th>Remount Status</th>
                  <th>Requested At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {remountRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.hoardingCode}</td>
                    <td>{row.clientName}</td>
                    <td>{row.location}</td>
                    <td>{String(row.currentStatus || "—").toUpperCase()}</td>
                    <td>
                      {row.remountStatus === "PENDING"
                        ? "Pending (Remount)"
                        : row.remountStatus || "—"}
                    </td>
                    <td>{fmtDateTime(row.remountRequestedAt)}</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        disabled={busyId === row.id || row.remountStatus === "PENDING"}
                        onClick={() => markRemount(row)}
                      >
                        {row.remountStatus === "PENDING" ? "Pending" : "Mark for Remount"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {remountRows.length === 0 && (
              <div style={{ textAlign: "center", padding: 20 }}>No eligible hoardings found.</div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 1150 }}>
              <thead>
                <tr>
                  <th>Hoarding Code</th>
                  <th>Client</th>
                  <th>Phone</th>
                  <th>Status Tag</th>
                  <th>Minimum Rate</th>
                  <th>Final Rate</th>
                  <th>Expiry Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {renewRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.hoardingCode}</td>
                    <td>{row.clientName}</td>
                    <td>{row.clientPhone}</td>
                    <td>{row.statusTag}</td>
                    <td>₹{Number(row.minimumRate || 0)}</td>
                    <td>{row.finalRate ? `₹${Number(row.finalRate)}` : "—"}</td>
                    <td>{fmtDate(row.expiryDate)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => openRenewModal(row)}
                        >
                          Extend / Renew
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => loadHistory(row.id)}
                        >
                          Renewal History
                        </button>
                      </div>
                      {historyByHoarding[row.id]?.length ? (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
                          {historyByHoarding[row.id].slice(0, 3).map((h) => (
                            <div key={h.id}>
                              {fmtDate(h.renewedAt)} • ₹{Number(h.newAmount)} • {h.tenure}m •{" "}
                              {h.renewedByName || "—"}
                              {h.remountRequired ? " • Remount" : ""}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renewRows.length === 0 && (
              <div style={{ textAlign: "center", padding: 20 }}>No live hoardings found for renewal.</div>
            )}
          </div>
        )}
      </div>

      {modalOpen && selected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ width: 520, maxWidth: "95vw" }}>
            <h3 style={{ marginBottom: 12 }}>
              Extend / Renew — {selected.hoardingCode}
            </h3>
            <div className="form-group">
              <label>New Tenure (months)</label>
              <select
                value={tenure}
                onChange={(e) => setTenure(Number(e.target.value || 1))}
              >
                <option value={1}>1 Month</option>
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
              </select>
            </div>
            <div className="form-group">
              <label>New Amount</label>
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="Enter amount"
              />
              <div style={{ fontSize: 12, marginTop: 6, color: "#64748b" }}>
                Minimum rate: ₹{Number(selected.minimumRate || 0)}
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={remountRequired}
                  onChange={(e) => setRemountRequired(e.target.checked)}
                />
                Remount Required?
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={busyId === selected.id}
                onClick={submitRenew}
              >
                {busyId === selected.id ? "Submitting..." : "Submit Renewal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
