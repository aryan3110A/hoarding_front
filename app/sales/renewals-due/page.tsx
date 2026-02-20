"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";
import { contractsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

type RenewalRow = {
  id: string;
  clientName: string;
  clientPhone: string;
  hoardingCode: string;
  location: string;
  contractStartDate: string | null;
  contractExpiryDate: string | null;
  daysRemaining: number | null;
  renewalMessageSent: boolean;
  renewalMessageSentAt: string | null;
  renewalMessageSentBy: string | null;
};

const ALLOWED_ROLES = ["sales", "owner", "manager", "accountant", "admin"];

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function SalesRenewalsDuePage() {
  const user = useUser();
  const [rows, setRows] = useState<RenewalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedClientKey, setSelectedClientKey] = useState<string>("all");

  const userRole = String(user?.role || "").toLowerCase();
  const canSend = ["sales", "owner", "manager", "admin"].includes(userRole);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const response = await contractsAPI.getRenewalsDue(15);
      const payload = response?.data ?? response ?? [];
      const list = Array.isArray(payload) ? payload : [];
      setRows(list);
    } catch (error: any) {
      setRows([]);
      showError(
        error?.response?.data?.message ||
          "Failed to load renewal due hoardings",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchRows();
  }, [user, fetchRows]);

  const handleSendReminder = async (contractId: string) => {
    try {
      setSendingId(contractId);
      const response = await contractsAPI.sendRenewalReminder(contractId);
      const payload = response?.data ?? response ?? {};

      setRows((prev) =>
        prev.map((row) =>
          row.id === contractId
            ? {
                ...row,
                renewalMessageSent: true,
                renewalMessageSentAt:
                  payload?.renewalMessageSentAt || new Date().toISOString(),
                renewalMessageSentBy:
                  payload?.renewalMessageSentBy || user?.name || "—",
              }
            : row,
        ),
      );

      showSuccess("Renewal WhatsApp reminder sent");
    } catch (error: any) {
      showError(
        error?.response?.data?.message || "Failed to send renewal reminder",
      );
    } finally {
      setSendingId(null);
    }
  };

  const clientGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        clientName: string;
        clientPhone: string;
        hoardingCount: number;
      }
    >();
    rows.forEach((row) => {
      const key = `${String(row.clientName || "—")}::${String(row.clientPhone || "—")}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          clientName: String(row.clientName || "—"),
          clientPhone: String(row.clientPhone || "—"),
          hoardingCount: 0,
        });
      }
      const item = map.get(key)!;
      item.hoardingCount += 1;
    });
    return Array.from(map.values()).sort((a, b) =>
      `${a.clientName} ${a.clientPhone}`.localeCompare(
        `${b.clientName} ${b.clientPhone}`,
      ),
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (selectedClientKey === "all") return rows;
    return rows.filter(
      (row) =>
        `${String(row.clientName || "—")}::${String(row.clientPhone || "—")}` ===
        selectedClientKey,
    );
  }, [rows, selectedClientKey]);

  const filteredTotalSent = useMemo(
    () => filteredRows.filter((r) => r.renewalMessageSent).length,
    [filteredRows],
  );

  const selectedHoardingCount = filteredRows.length;

  useEffect(() => {
    if (selectedClientKey === "all") return;
    const stillExists = clientGroups.some(
      (group) => group.key === selectedClientKey,
    );
    if (!stillExists) {
      setSelectedClientKey("all");
    }
  }, [clientGroups, selectedClientKey]);

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!ALLOWED_ROLES.includes(userRole)) {
    return <AccessDenied />;
  }

  return (
    <div>
      <h1 style={{ marginBottom: "12px" }}>Renewals Due (15 Days)</h1>
      <p style={{ marginBottom: "20px", color: "var(--text-secondary)" }}>
        Hoardings with expiry date within the next 15 days.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "14px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <select
          value={selectedClientKey}
          onChange={(e) => setSelectedClientKey(e.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="all">All Clients</option>
          {clientGroups.map((group) => (
            <option key={group.key} value={group.key}>
              {group.clientName} ({group.clientPhone}) - {group.hoardingCount}{" "}
              hoarding(s)
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ marginBottom: "14px" }}>
        <strong>Total Due:</strong> {filteredRows.length} &nbsp; | &nbsp;{" "}
        <strong>No. of Hoardings:</strong> {selectedHoardingCount}
        &nbsp; | &nbsp; <strong>Reminder Sent:</strong> {filteredTotalSent}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "24px" }}>
            Loading live hoardings...
          </div>
        ) : filteredRows.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: "var(--text-secondary)",
            }}
          >
            No hoardings are due for renewal in the next 15 days for the
            selected client.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              className="table"
              style={{ marginTop: "10px", minWidth: 1200 }}
            >
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Client Phone</th>
                  <th>Hoarding Code</th>
                  <th>Location</th>
                  <th>Live Start Date</th>
                  <th>Expiry Date</th>
                  <th>Days Remaining</th>
                  <th>Renewal Message Sent</th>
                  <th>Sent Date/Time</th>
                  <th>Sent By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const disabled =
                    !canSend || row.renewalMessageSent || sendingId === row.id;
                  return (
                    <tr key={row.id}>
                      <td>{row.clientName || "—"}</td>
                      <td>{row.clientPhone || "—"}</td>
                      <td>{row.hoardingCode || "—"}</td>
                      <td>{row.location || "—"}</td>
                      <td>{fmtDate(row.contractStartDate)}</td>
                      <td>{fmtDate(row.contractExpiryDate)}</td>
                      <td>{row.daysRemaining ?? "—"}</td>
                      <td>{row.renewalMessageSent ? "Yes" : "No"}</td>
                      <td>{fmtDateTime(row.renewalMessageSentAt)}</td>
                      <td>{row.renewalMessageSentBy || "—"}</td>
                      <td>
                        <button
                          className="btn btn-sm"
                          disabled={disabled}
                          onClick={() => handleSendReminder(row.id)}
                        >
                          {row.renewalMessageSent
                            ? "Already Sent"
                            : sendingId === row.id
                              ? "Sending..."
                              : "Send Renewal WhatsApp"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
