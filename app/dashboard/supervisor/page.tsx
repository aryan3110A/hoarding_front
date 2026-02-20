"use client";

import { useEffect, useMemo, useState } from "react";
import { supervisorAPI } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/components/AppLayout";
import { showError, showSuccess } from "@/lib/toast";

const executionTypes = [
  { value: "CLIENT_DIRECT_FLEX", label: "Direct flex provided by client" },
  { value: "CLIENT_CDR", label: "Client provides CDR file" },
  { value: "IN_HOUSE_DESIGN", label: "In-house designing" },
];

const statusOptions = [
  { value: "booked", label: "Booked" },
  { value: "under_process", label: "Under Process" },
  { value: "live", label: "Live" },
  { value: "remount_pending", label: "Remount Pending" },
  { value: "removal_pending", label: "Removal Pending" },
];

const statusBadge = (status?: string, remountStatus?: string | null) => {
  const s = String(status || "").toLowerCase();
  const remount = String(remountStatus || "").toLowerCase();
  if (remount === "pending") {
    return { text: "Live + Remount Pending", color: "#dc2626" };
  }
  if (s === "booked") return { text: "Booked", color: "#0ea5e9" };
  if (s === "under_process") return { text: "Under Process", color: "#f59e0b" };
  if (s === "live") return { text: "Live", color: "#22c55e" };
  if (s === "removal_pending")
    return { text: "Removal Pending", color: "#ef4444" };
  return { text: status || "—", color: "#6b7280" };
};

const designStatusLabel = (raw?: string) => {
  const normalized = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (normalized === "completed") return "Completed";
  if (normalized === "in_progress" || normalized === "inprogress")
    return "In Progress";
  if (normalized === "pending") return "Pending";
  return raw ? String(raw) : "Pending";
};

export default function SupervisorDashboardPage() {
  const user = useUser();
  const roleLower = String(user?.role || "").toLowerCase();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  const [status, setStatus] = useState("");
  const [sizeMatch, setSizeMatch] = useState("");
  const [condition, setCondition] = useState("");
  const [materialReceived, setMaterialReceived] = useState("");

  const [designers, setDesigners] = useState<any[]>([]);
  const [designerDrafts, setDesignerDrafts] = useState<Record<string, string>>(
    {},
  );
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [settingLiveDateId, setSettingLiveDateId] = useState<string | null>(
    null,
  );
  const [liveDateDrafts, setLiveDateDrafts] = useState<Record<string, string>>(
    {},
  );

  const canManage = useMemo(() => {
    return ["supervisor", "owner", "manager", "admin"].includes(roleLower);
  }, [roleLower]);

  const fetchDesigners = async () => {
    try {
      const resp = await supervisorAPI.listDesigners();
      if (resp?.success) {
        setDesigners(Array.isArray(resp.data) ? resp.data : []);
      }
    } catch (_) {
      setDesigners([]);
    }
  };

  const fetchRows = async () => {
    if (!canManage) return;
    try {
      setLoading(true);
      const resp = await supervisorAPI.listHoardings({
        page,
        limit,
        status: status || undefined,
        sizeMatch: sizeMatch || undefined,
        condition: condition || undefined,
        materialReceived: materialReceived || undefined,
      });
      if (resp?.success) {
        setRows(resp.data?.rows || []);
        setTotal(resp.data?.total || 0);
      } else {
        setRows([]);
        setTotal(0);
        showError(resp?.message || "Failed to load supervisor hoardings");
      }
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      showError(
        e?.response?.data?.message || "Failed to load supervisor hoardings",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, sizeMatch, condition, materialReceived]);

  // Live updates for design status
  useEffect(() => {
    if (!canManage) return;
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:3001";
    const accessToken =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const query = accessToken
      ? `?token=${encodeURIComponent(accessToken)}`
      : "";
    const url = `${apiBase}/api/events/design-status${query}`;
    const source = new EventSource(url as any);
    source.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data || "{}") as {
          hoardingId?: string;
          designStatus?: string;
        };
        if (!payload?.hoardingId) return;
        setRows((prev) =>
          (prev || []).map((h) =>
            String(h.id) === String(payload.hoardingId)
              ? { ...h, latestDesignStatus: payload.designStatus }
              : h,
          ),
        );
      } catch (_) {}
    };
    source.onerror = () => {
      // ignore; browser reconnects
    };
    return () => {
      try {
        source.close();
      } catch (_) {}
    };
  }, [canManage]);

  useEffect(() => {
    setDesignerDrafts((prev) => {
      const next = { ...prev };
      (rows || []).forEach((h: any) => {
        const id = String(h?.id || "");
        if (!id) return;
        const current = h?.designerId ? String(h.designerId) : "";
        if (!next[id] || next[id] !== current) {
          next[id] = current;
        }
      });
      return next;
    });
  }, [rows]);

  const updateChecklist = async (id: string, patch: any) => {
    // Optimistic local update to avoid full refresh
    setRows((prev) =>
      (prev || []).map((h) => {
        if (String(h.id) !== String(id)) return h;
        return {
          ...h,
          supervisorChecklist: {
            ...(h.supervisorChecklist || {}),
            ...patch,
          },
        };
      }),
    );

    try {
      const resp = await supervisorAPI.updateChecklist(id, patch);
      if (resp?.success) {
        showSuccess("Checklist updated");
      } else {
        showError(resp?.message || "Failed to update checklist");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to update checklist");
    }
  };

  const uploadChecklistImage = async (id: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      setUploadingId(String(id));
      const resp = await supervisorAPI.uploadChecklistImage(
        id,
        Array.from(files),
      );
      if (resp?.success) {
        showSuccess("Image uploaded");
        setRows((prev) =>
          (prev || []).map((h) =>
            String(h.id) === String(id)
              ? {
                  ...h,
                  supervisorChecklist: {
                    ...(h.supervisorChecklist || {}),
                    isSiteImageUploaded: true,
                    siteImages:
                      resp?.data?.siteImages ||
                      h?.supervisorChecklist?.siteImages,
                  },
                }
              : h,
          ),
        );
      } else {
        showError(resp?.message || "Failed to upload image");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to upload image");
    } finally {
      setUploadingId(null);
    }
  };

  const setExecutionType = async (
    id: string,
    executionType: string,
    designerId?: string,
  ) => {
    // Optimistic local update to avoid full refresh
    setRows((prev) =>
      (prev || []).map((h) =>
        String(h.id) === String(id)
          ? { ...h, executionType, designerId: designerId || h.designerId }
          : h,
      ),
    );

    try {
      const resp = await supervisorAPI.setExecutionType(id, {
        executionType,
        designerId: designerId || undefined,
      });
      if (resp?.success) {
        showSuccess("Execution type updated");
      } else {
        showError(resp?.message || "Failed to update execution type");
      }
    } catch (e: any) {
      showError(
        e?.response?.data?.message || "Failed to update execution type",
      );
    }
  };

  const assignDesigner = async (id: string, designerId: string) => {
    if (!designerId) {
      showError("Please select a designer");
      return;
    }
    const row = (rows || []).find((r) => String(r.id) === String(id));
    const execType = String(row?.executionType || "");
    if (!execType) {
      showError("Please select an execution type first");
      return;
    }
    try {
      setAssigningId(String(id));
      const resp = await supervisorAPI.setExecutionType(id, {
        executionType: execType,
        designerId,
      });
      if (resp?.success) {
        showSuccess("Designer assigned");
        fetchRows();
      } else {
        showError(resp?.message || "Failed to assign designer");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to assign designer");
    } finally {
      setAssigningId(null);
    }
  };

  const markLive = async (id: string, liveDate?: string) => {
    if (!confirm("Mark hoarding as Live?")) return;
    try {
      // Optimistic local update
      setRows((prev) =>
        (prev || []).map((h) =>
          String(h.id) === String(id) ? { ...h, status: "live" } : h,
        ),
      );
      const resp = await supervisorAPI.markLive(
        id,
        liveDate ? { liveDate } : undefined,
      );
      if (resp?.success) {
        showSuccess("Marked as Live");
      } else {
        showError(resp?.message || "Failed to mark as Live");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to mark as Live");
    }
  };

  const setPlannedLiveDate = async (id: string, plannedLiveDate: string) => {
    if (!plannedLiveDate) {
      showError("Please select a date");
      return;
    }
    try {
      setSettingLiveDateId(String(id));
      const resp = await supervisorAPI.setLiveDate(id, { plannedLiveDate });
      if (resp?.success) {
        showSuccess("Live date saved");
        setRows((prev) =>
          (prev || []).map((h) =>
            String(h.id) === String(id)
              ? { ...h, plannedLiveDate: plannedLiveDate }
              : h,
          ),
        );
        setLiveDateDrafts((prev) => {
          const next = { ...prev };
          delete next[String(id)];
          return next;
        });
      } else {
        showError(resp?.message || "Failed to save live date");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to save live date");
    } finally {
      setSettingLiveDateId(null);
    }
  };

  const markRemoval = async (id: string) => {
    const reason = prompt("Reason for removal?");
    if (!reason) return;
    try {
      const resp = await supervisorAPI.markRemoval(id, reason);
      if (resp?.success) {
        showSuccess("Marked for removal");
        fetchRows();
      } else {
        showError(resp?.message || "Failed to mark for removal");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to mark for removal");
    }
  };

  const completeRemount = async (id: string) => {
    if (!confirm("Mark remount as completed?")) return;
    try {
      const resp = await supervisorAPI.completeRemount(id);
      if (resp?.success) {
        showSuccess("Remount marked completed");
        setRows((prev) =>
          (prev || []).map((h) =>
            String(h.id) === String(id)
              ? {
                  ...h,
                  remountStatus: "COMPLETED",
                  remountCompletedAt: new Date().toISOString(),
                }
              : h,
          ),
        );
      } else {
        showError(resp?.message || "Failed to complete remount");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to complete remount");
    }
  };

  const downloadPdf = async (id: string) => {
    try {
      const resp = await supervisorAPI.getOperationalPdf(id);
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hoarding-${id}-operational.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to generate PDF");
    }
  };

  return (
    <ProtectedRoute component="hoardings">
      <div className="page-container">
        <h1 className="page-title">Supervisor Dashboard</h1>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Filters</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option>
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={sizeMatch}
              onChange={(e) => setSizeMatch(e.target.value)}
            >
              <option value="">Size Match (All)</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              <option value="">Condition (All)</option>
              <option value="good">Good</option>
              <option value="damaged">Damaged</option>
            </select>
            <select
              value={materialReceived}
              onChange={(e) => setMaterialReceived(e.target.value)}
            >
              <option value="">Material Received (All)</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Execution Type</th>
                    <th>Checklist</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h: any) => {
                    const checklist = h.supervisorChecklist || {};
                    const isComplete =
                      checklist.isCorrectSize &&
                      checklist.isGoodCondition &&
                      checklist.isFlexReceived &&
                      checklist.isReadyForInstall &&
                      checklist.isSiteImageUploaded;
                    const execType = h.executionType || "";
                    const needsDesigner = execType === "IN_HOUSE_DESIGN";
                    const statusLower = String(h.status || "").toLowerCase();
                    const designStatusLower = String(
                      h.latestDesignStatus || "",
                    ).toLowerCase();
                    const needsDesignComplete = execType === "IN_HOUSE_DESIGN";
                    const isDesignCompleted =
                      !needsDesignComplete || designStatusLower === "completed";
                    const plannedLiveDateRaw = h?.plannedLiveDate;
                    const plannedLiveDateObj = plannedLiveDateRaw
                      ? new Date(String(plannedLiveDateRaw))
                      : null;
                    const plannedLiveDateValue =
                      plannedLiveDateObj && !isNaN(plannedLiveDateObj.getTime())
                        ? plannedLiveDateObj.toISOString().slice(0, 10)
                        : "";
                    const liveDateDraft = liveDateDrafts[String(h.id)] || "";
                    const liveDateValue = plannedLiveDateValue || liveDateDraft;
                    const canMarkLive =
                      statusLower !== "live" &&
                      !!checklist.isReadyForInstall &&
                      isDesignCompleted &&
                      !!plannedLiveDateValue;
                    const canMarkRemoval = statusLower !== "removal_pending";
                    const canCompleteRemount =
                      String(h?.remountStatus || "").toLowerCase() ===
                      "pending";
                    const markLiveTooltip = canMarkLive
                      ? "Mark Live"
                      : !plannedLiveDateValue
                        ? "Set live date"
                        : needsDesignComplete && !isDesignCompleted
                          ? "Requires: Design completed"
                          : "Requires: Ready for Install and not already Live";
                    const markRemovalTooltip = canMarkRemoval
                      ? "Mark for Removal"
                      : "Already in Removal Pending";
                    return (
                      <tr key={h.id}>
                        <td>{h.code || h.id}</td>
                        <td>
                          {(() => {
                            const b = statusBadge(h.status, h.remountStatus);
                            return (
                              <span
                                style={{
                                  background: b.color,
                                  color: "white",
                                  padding: "2px 8px",
                                  borderRadius: 12,
                                  fontSize: 12,
                                }}
                              >
                                {b.text}
                              </span>
                            );
                          })()}
                        </td>
                        <td>
                          <select
                            value={execType}
                            onChange={(e) => {
                              e.stopPropagation();
                              setExecutionType(
                                h.id,
                                e.target.value,
                                h.designerId,
                              );
                            }}
                          >
                            <option value="">Select</option>
                            {executionTypes.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <div style={{ marginTop: 8 }}>
                            <select
                              value={designerDrafts[String(h.id)] || ""}
                              onChange={(e) => {
                                e.stopPropagation();
                                const val = e.target.value;
                                setDesignerDrafts((prev) => ({
                                  ...prev,
                                  [String(h.id)]: val,
                                }));
                              }}
                              disabled={!execType}
                            >
                              <option value="">Select Designer</option>
                              {designers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name || d.email || d.id}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-primary"
                              style={{ marginTop: 8 }}
                              disabled={
                                !execType ||
                                assigningId === String(h.id) ||
                                !designerDrafts[String(h.id)]
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                assignDesigner(
                                  h.id,
                                  designerDrafts[String(h.id)] || "",
                                );
                              }}
                            >
                              Assign Designer
                            </button>
                            {!execType && (
                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 12,
                                  color: "#6b7280",
                                }}
                              >
                                Select an execution type to assign a designer.
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 12,
                              color: "#6b7280",
                            }}
                          >
                            Design status:{" "}
                            {designStatusLabel(designStatusLower)}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "grid", gap: 6 }}>
                            <label title="Correct size">
                              <input
                                type="checkbox"
                                checked={!!checklist.isCorrectSize}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateChecklist(h.id, {
                                    isCorrectSize: e.target.checked,
                                  });
                                }}
                              />{" "}
                              Size OK
                            </label>
                            <label title="Good condition">
                              <input
                                type="checkbox"
                                checked={!!checklist.isGoodCondition}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateChecklist(h.id, {
                                    isGoodCondition: e.target.checked,
                                  });
                                }}
                              />{" "}
                              Condition OK
                            </label>
                            <label title="Flex received">
                              <input
                                type="checkbox"
                                checked={!!checklist.isFlexReceived}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateChecklist(h.id, {
                                    isFlexReceived: e.target.checked,
                                  });
                                }}
                              />{" "}
                              Material Received
                            </label>
                            <label title="Ready for installation">
                              <input
                                type="checkbox"
                                checked={!!checklist.isReadyForInstall}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateChecklist(h.id, {
                                    isReadyForInstall: e.target.checked,
                                  });
                                }}
                              />{" "}
                              Ready for Install
                            </label>
                            <div>
                              <label title="Site image uploaded">
                                <input
                                  type="checkbox"
                                  checked={!!checklist.isSiteImageUploaded}
                                  readOnly
                                />{" "}
                                Site Image Uploaded
                              </label>
                              <div style={{ marginTop: 6 }}>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    uploadChecklistImage(h.id, e.target.files)
                                  }
                                  disabled={uploadingId === String(h.id)}
                                />
                              </div>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: isComplete ? "green" : "#999",
                              }}
                            >
                              {isComplete
                                ? "Checklist complete"
                                : "Checklist incomplete"}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="btn btn-secondary"
                              disabled={!canMarkLive}
                              title={markLiveTooltip}
                              onClick={() =>
                                markLive(
                                  h.id,
                                  plannedLiveDateValue || undefined,
                                )
                              }
                            >
                              Mark Live
                            </button>
                            <input
                              type="date"
                              value={liveDateValue}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLiveDateDrafts((prev) => ({
                                  ...prev,
                                  [String(h.id)]: val,
                                }));
                                if (val) {
                                  setPlannedLiveDate(h.id, val);
                                }
                              }}
                              disabled={
                                !!plannedLiveDateValue ||
                                settingLiveDateId === String(h.id) ||
                                statusLower === "live"
                              }
                              style={{ maxWidth: 170 }}
                              title="Live date"
                            />
                            <button
                              className="btn btn-secondary"
                              disabled={!canMarkRemoval}
                              title={markRemovalTooltip}
                              onClick={() => markRemoval(h.id)}
                            >
                              Mark Removal
                            </button>
                            <button
                              className="btn btn-secondary"
                              disabled={!canCompleteRemount}
                              title={
                                canCompleteRemount
                                  ? "Complete remount"
                                  : "No pending remount"
                              }
                              onClick={() => completeRemount(h.id)}
                            >
                              Complete Remount
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => downloadPdf(h.id)}
                            >
                              PDF
                            </button>
                          </div>
                          {!canMarkLive && (
                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 12,
                                color: "#6b7280",
                              }}
                            >
                              Set the live date first. Duration starts from that
                              date.
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <div>No hoardings found.</div>}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <button
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <div>
            Page {page} / {Math.max(1, Math.ceil(total / limit))}
          </div>
          <button
            className="btn btn-secondary"
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
