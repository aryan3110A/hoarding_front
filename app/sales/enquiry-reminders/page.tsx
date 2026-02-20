"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { enquiriesAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

type ReminderRange = "today" | "next7" | "all";

const rangeOptions: Array<{ value: ReminderRange; label: string }> = [
  { value: "today", label: "Today only" },
  { value: "next7", label: "Next 7 days" },
  { value: "all", label: "All upcoming" },
];

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

export default function EnquiryRemindersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<ReminderRange>("next7");
  const [reRemindId, setReRemindId] = useState<string>("");
  const [reRemindDate, setReRemindDate] = useState<string>("");

  const fetchRows = async (selectedRange: ReminderRange) => {
    try {
      setLoading(true);
      const res = await enquiriesAPI.getReminders({ range: selectedRange });
      const payload = res?.data || {};
      const list = Array.isArray(payload?.inquiries) ? payload.inquiries : [];
      setRows(list);
    } catch (error: any) {
      showError(error?.response?.data?.message || "Failed to load reminders");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(range);
  }, [range]);

  const markDone = async (id: string) => {
    try {
      const res = await enquiriesAPI.update(id, { followupStatus: "DONE" });
      const updated = res?.data;
      setRows((prev) =>
        (prev || []).map((item) =>
          item?.id === id
            ? { ...item, ...(updated || {}), followupStatus: "DONE" }
            : item,
        ),
      );
      showSuccess("Follow-up marked as done");
    } catch (error: any) {
      showError(error?.response?.data?.message || "Failed to mark done");
    }
  };

  const saveReRemind = async (id: string) => {
    if (!reRemindDate) {
      showError("Please select a follow-up date");
      return;
    }
    const today = toDateInput(startOfToday());
    if (reRemindDate < today) {
      showError("Next follow-up date cannot be in the past");
      return;
    }

    try {
      const res = await enquiriesAPI.update(id, {
        nextFollowupDate: reRemindDate,
        followupStatus: "PENDING",
      });
      const updated = res?.data;
      setRows((prev) =>
        (prev || []).map((item) =>
          item?.id === id
            ? {
                ...item,
                ...(updated || {}),
                nextFollowupDate:
                  updated?.nextFollowupDate ||
                  new Date(reRemindDate).toISOString(),
                followupStatus: "PENDING",
              }
            : item,
        ),
      );
      setReRemindId("");
      setReRemindDate("");
      showSuccess("Follow-up reminder updated");
    } catch (error: any) {
      showError(error?.response?.data?.message || "Failed to update reminder");
    }
  };

  const getDueMeta = (iso?: string | null) => {
    if (!iso) return { label: "-", className: "bg-slate-100 text-slate-700" };
    const today = startOfToday();
    const due = new Date(iso);
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffDays = Math.ceil(
      (dueStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) {
      return {
        label: `${Math.abs(diffDays)} day(s) overdue`,
        className: "bg-red-100 text-red-700",
      };
    }
    if (diffDays === 0) {
      return { label: "Due today", className: "bg-yellow-100 text-yellow-700" };
    }
    return {
      label: `${diffDays} day(s) remaining`,
      className: "bg-green-100 text-green-700",
    };
  };

  const pendingCount = useMemo(
    () =>
      rows.filter((row) => String(row?.followupStatus || "") !== "DONE").length,
    [rows],
  );

  return (
    <ProtectedRoute component="enquiries">
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <h1>Enquiry Reminders</h1>
          <div className="flex items-center gap-2">
            <strong>Pending:</strong> {pendingCount}
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as ReminderRange)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {rangeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding: "16px" }}>Loading reminders...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center" }}>
              No follow-up reminders found for selected range.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Company Name</th>
                  <th>Mobile Number</th>
                  <th>Assigned Sales Person</th>
                  <th>Next Follow-up Date</th>
                  <th>Days Remaining</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const dueMeta = getDueMeta(row?.nextFollowupDate);
                  const isDone = String(row?.followupStatus || "") === "DONE";
                  const isEditing = reRemindId === String(row.id);
                  return (
                    <tr
                      key={row.id}
                      style={isDone ? { opacity: 0.55 } : undefined}
                    >
                      <td>{row?.clientName || "-"}</td>
                      <td>{row?.companyName || "-"}</td>
                      <td>{row?.phone || "-"}</td>
                      <td>{row?.assignedSales?.name || "Unassigned"}</td>
                      <td>
                        {row?.nextFollowupDate
                          ? new Date(row.nextFollowupDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${dueMeta.className}`}
                        >
                          {dueMeta.label}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            isDone
                              ? "bg-slate-100 text-slate-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {isDone ? "DONE" : "PENDING"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-secondary"
                            onClick={() => markDone(String(row.id))}
                            disabled={isDone}
                          >
                            Mark Done
                          </button>

                          {!isEditing ? (
                            <button
                              className="btn btn-primary"
                              onClick={() => {
                                setReRemindId(String(row.id));
                                setReRemindDate(
                                  row?.nextFollowupDate
                                    ? toDateInput(
                                        new Date(row.nextFollowupDate),
                                      )
                                    : "",
                                );
                              }}
                            >
                              Re-Remind
                            </button>
                          ) : (
                            <>
                              <input
                                type="date"
                                min={toDateInput(startOfToday())}
                                value={reRemindDate}
                                onChange={(e) =>
                                  setReRemindDate(e.target.value)
                                }
                              />
                              <button
                                className="btn btn-primary"
                                onClick={() => saveReRemind(String(row.id))}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  setReRemindId("");
                                  setReRemindDate("");
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
