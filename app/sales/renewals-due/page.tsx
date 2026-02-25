"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";
import CustomSelect from "@/components/CustomSelect";
import { contractsAPI, hoardingsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

type RenewalDueRow = {
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

type StatusRow = {
  id: string;
  clientName: string;
  clientPhone: string;
  hoardingCode: string;
  location: string;
  currentStatus: string;
  expiryDate: string | null;
};

type StatusTab = "pending" | "live" | "renewalDue";

type HoardingListRow = {
  id: string;
  code?: string;
  status?: string;
  city?: string;
  area?: string;
  landmark?: string;
  roadName?: string;
  expiryDate?: string | null;
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

function getDaysRemaining(dateValue?: string | null) {
  if (!dateValue) return null;
  const now = new Date();
  const end = new Date(dateValue);
  if (Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isExpired(dateValue?: string | null) {
  if (!dateValue) return false;
  const expiry = new Date(dateValue);
  if (Number.isNaN(expiry.getTime())) return false;
  expiry.setHours(23, 59, 59, 999);
  return new Date().getTime() > expiry.getTime();
}

export default function SalesRenewalsDuePage() {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [renewalDueRows, setRenewalDueRows] = useState<RenewalDueRow[]>([]);
  const [statusRowsFromRemountApi, setStatusRowsFromRemountApi] = useState<
    StatusRow[]
  >([]);
  const [statusRowsFromHoardingsApi, setStatusRowsFromHoardingsApi] = useState<
    StatusRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notifySupervisorId, setNotifySupervisorId] = useState<string | null>(
    null,
  );
  const [selectedClientKey, setSelectedClientKey] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<StatusTab>("renewalDue");

  const userRole = String(user?.role || "").toLowerCase();
  const canSend = ["sales", "owner", "manager", "admin"].includes(userRole);

  const setTabAndRoute = useCallback(
    (nextTab: StatusTab) => {
      setActiveTab(nextTab);
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", nextTab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const raw = String(searchParams?.get("tab") || "")
      .trim()
      .toLowerCase();
    if (raw === "pending" || raw === "live" || raw === "renewaldue") {
      setActiveTab(raw === "renewaldue" ? "renewalDue" : (raw as StatusTab));
    }
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [renewalsResult, statusResult, hoardingsResult] =
        await Promise.allSettled([
          contractsAPI.getRenewalsDue(15),
          hoardingsAPI.listRemountRenew(),
          hoardingsAPI.getAll({ page: 1, limit: 2000 }),
        ]);

      if (renewalsResult.status === "fulfilled") {
        const payload =
          renewalsResult.value?.data ?? renewalsResult.value ?? [];
        setRenewalDueRows(Array.isArray(payload) ? payload : []);
      } else {
        setRenewalDueRows([]);
        showError("Failed to load renewal due hoardings");
      }

      if (statusResult.status === "fulfilled") {
        const payload = statusResult.value?.data ?? statusResult.value ?? [];
        setStatusRowsFromRemountApi(Array.isArray(payload) ? payload : []);
      } else {
        setStatusRowsFromRemountApi([]);
        showError("Failed to load hoarding status data");
      }

      if (hoardingsResult.status === "fulfilled") {
        const payload =
          hoardingsResult.value?.data?.hoardings ??
          hoardingsResult.value?.data ??
          [];
        const list: HoardingListRow[] = Array.isArray(payload) ? payload : [];
        const mapped: StatusRow[] = list.map((row) => {
          const location = [row.landmark, row.area, row.roadName, row.city]
            .filter(Boolean)
            .join(", ");
          return {
            id: String(row.id || ""),
            clientName: "—",
            clientPhone: "—",
            hoardingCode: String(row.code || "—"),
            location: location || "—",
            currentStatus: String(row.status || "").toLowerCase(),
            expiryDate: row.expiryDate || null,
          };
        });
        setStatusRowsFromHoardingsApi(mapped);
      } else {
        setStatusRowsFromHoardingsApi([]);
      }
    } catch (error: any) {
      setRenewalDueRows([]);
      setStatusRowsFromRemountApi([]);
      setStatusRowsFromHoardingsApi([]);
      showError(error?.response?.data?.message || "Failed to load status data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, fetchData]);

  const handleSendReminder = async (contractId: string) => {
    try {
      setSendingId(contractId);
      const response = await contractsAPI.sendRenewalReminder(contractId);
      const payload = response?.data ?? response ?? {};

      setRenewalDueRows((prev) =>
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

  const handleNotifySupervisor = async (hoardingId: string) => {
    try {
      setNotifySupervisorId(hoardingId);
      await hoardingsAPI.sendSupervisorNotification(hoardingId);
      showSuccess("Notification sent to supervisor");
    } catch (error: any) {
      showError(
        error?.response?.data?.message ||
          "Failed to send notification to supervisor",
      );
    } finally {
      setNotifySupervisorId(null);
    }
  };

  const statusRows = useMemo(() => {
    const byId = new Map<string, StatusRow>();
    statusRowsFromHoardingsApi.forEach((row) => {
      const id = String(row.id || "");
      if (!id) return;
      byId.set(id, row);
    });
    statusRowsFromRemountApi.forEach((row) => {
      const id = String(row.id || "");
      if (!id) return;
      byId.set(id, row);
    });
    return Array.from(byId.values());
  }, [statusRowsFromHoardingsApi, statusRowsFromRemountApi]);

  const pendingRows = useMemo(
    () =>
      statusRows.filter((row) => {
        const normalized = String(row.currentStatus || "").toLowerCase();
        return ["booked", "under_process"].includes(normalized);
      }),
    [statusRows],
  );

  const liveRows = useMemo(
    () =>
      statusRows.filter((row) => {
        const normalized = String(row.currentStatus || "").toLowerCase();
        if (normalized !== "live") return false;
        return !isExpired(row.expiryDate);
      }),
    [statusRows],
  );

  const activeClientBase = useMemo(() => {
    if (activeTab === "pending") return pendingRows;
    if (activeTab === "live") return liveRows;
    return renewalDueRows;
  }, [activeTab, pendingRows, liveRows, renewalDueRows]);

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

    activeClientBase.forEach((row: any) => {
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
  }, [activeClientBase]);

  const clientOptions = useMemo(
    () => [
      { value: "all", label: "All Clients" },
      ...clientGroups.map((group) => ({
        value: group.key,
        label: `${group.clientName} (${group.clientPhone}) - ${group.hoardingCount} hoarding(s)`,
      })),
    ],
    [clientGroups],
  );

  const isSelectedClient = useCallback(
    (clientName?: string, clientPhone?: string) => {
      if (selectedClientKey === "all") return true;
      const key = `${String(clientName || "—")}::${String(clientPhone || "—")}`;
      return key === selectedClientKey;
    },
    [selectedClientKey],
  );

  const filteredRenewalDueRows = useMemo(
    () =>
      renewalDueRows.filter((row) =>
        isSelectedClient(row.clientName, row.clientPhone),
      ),
    [renewalDueRows, isSelectedClient],
  );

  const filteredPendingRows = useMemo(
    () =>
      pendingRows.filter((row) =>
        isSelectedClient(row.clientName, row.clientPhone),
      ),
    [pendingRows, isSelectedClient],
  );

  const filteredLiveRows = useMemo(
    () =>
      liveRows.filter((row) =>
        isSelectedClient(row.clientName, row.clientPhone),
      ),
    [liveRows, isSelectedClient],
  );

  const filteredTotalSent = useMemo(
    () => filteredRenewalDueRows.filter((r) => r.renewalMessageSent).length,
    [filteredRenewalDueRows],
  );

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
      <h1 style={{ marginBottom: "12px" }}>Status</h1>
      <p style={{ marginBottom: "20px", color: "var(--text-secondary)" }}>
        Track booked (not mounted), live, and renewal due hoardings.
      </p>

      <div
        style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}
      >
        <button
          className={
            activeTab === "pending" ? "btn btn-primary" : "btn btn-tab-inactive"
          }
          onClick={() => setTabAndRoute("pending")}
        >
          Pending
        </button>
        <button
          className={
            activeTab === "live" ? "btn btn-primary" : "btn btn-tab-inactive"
          }
          onClick={() => setTabAndRoute("live")}
        >
          Live
        </button>
        <button
          className={
            activeTab === "renewalDue"
              ? "btn btn-primary"
              : "btn btn-tab-inactive"
          }
          onClick={() => setTabAndRoute("renewalDue")}
        >
          Renewal Due (15 Days)
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "14px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div className="w-[380px] max-w-full">
          <CustomSelect
            value={selectedClientKey}
            onChange={(v) => setSelectedClientKey(v)}
            options={clientOptions}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: "14px" }}>
        {activeTab === "pending" ? (
          <>
            <strong>Total Pending:</strong> {filteredPendingRows.length} &nbsp;
            | &nbsp; <strong>No. of Hoardings:</strong>{" "}
            {filteredPendingRows.length}
          </>
        ) : activeTab === "live" ? (
          <>
            <strong>Total Live:</strong> {filteredLiveRows.length} &nbsp; |
            &nbsp; <strong>No. of Hoardings:</strong> {filteredLiveRows.length}
          </>
        ) : (
          <>
            <strong>Total Due:</strong> {filteredRenewalDueRows.length} &nbsp; |
            &nbsp; <strong>No. of Hoardings:</strong>{" "}
            {filteredRenewalDueRows.length}
            &nbsp; | &nbsp; <strong>Reminder Sent:</strong> {filteredTotalSent}
          </>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "24px" }}>
            Loading hoardings...
          </div>
        ) : activeTab === "renewalDue" ? (
          filteredRenewalDueRows.length === 0 ? (
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
                  {filteredRenewalDueRows.map((row) => {
                    const disabled =
                      !canSend ||
                      row.renewalMessageSent ||
                      sendingId === row.id;
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
          )
        ) : (
          (() => {
            const isPending = activeTab === "pending";
            const list = isPending ? filteredPendingRows : filteredLiveRows;
            return list.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "var(--text-secondary)",
                }}
              >
                {isPending
                  ? "No pending (booked / not mounted) hoardings found for the selected client."
                  : "No live hoardings found for the selected client."}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  className="table"
                  style={{ marginTop: "10px", minWidth: 1050 }}
                >
                  <thead>
                    <tr>
                      <th>Client Name</th>
                      <th>Client Phone</th>
                      <th>Hoarding Code</th>
                      <th>Location</th>
                      <th>Current Status</th>
                      <th>Expiry Date</th>
                      <th>Days Remaining</th>
                      {isPending ? <th>Action</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((row) => {
                      const days = getDaysRemaining(row.expiryDate);
                      const isNotifyLoading = notifySupervisorId === row.id;
                      return (
                        <tr key={row.id}>
                          <td>{row.clientName || "—"}</td>
                          <td>{row.clientPhone || "—"}</td>
                          <td>{row.hoardingCode || "—"}</td>
                          <td>{row.location || "—"}</td>
                          <td>
                            {String(row.currentStatus || "—").toUpperCase()}
                          </td>
                          <td>{fmtDate(row.expiryDate)}</td>
                          <td>{days ?? "—"}</td>
                          {isPending ? (
                            <td>
                              <button
                                className="btn btn-secondary"
                                disabled={isNotifyLoading}
                                onClick={() => handleNotifySupervisor(row.id)}
                              >
                                {isNotifyLoading
                                  ? "Sending..."
                                  : "Send Notification"}
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
