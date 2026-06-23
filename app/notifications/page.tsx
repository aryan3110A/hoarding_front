"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/components/AppLayout";
import { bookingTokensAPI, hoardingsAPI, notificationsAPI, proposalsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

export default function Notifications() {
  const user = useUser();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [fitters, setFitters] = useState<any[]>([]);
  const [loadingFitters, setLoadingFitters] = useState(false);
  const [assigningNotificationId, setAssigningNotificationId] = useState<string | null>(null);
  const [selectedFitterByNotification, setSelectedFitterByNotification] = useState<Record<string, string>>({});
  const [assignedFitterByTokenId, setAssignedFitterByTokenId] = useState<Record<string, { fitterId: string; fitterName?: string }>>({});

  const roleLower = String(user?.role?.name || user?.role || "").toLowerCase().trim();
  const canAssignFitterFromNotifications = false;
  const canMarkBookedFromNotifications = roleLower === "owner" || roleLower === "manager" || roleLower === "sales" || roleLower === "admin";
  const canApproveRateFromNotifications = roleLower === "owner" || roleLower === "manager" || roleLower === "admin";

  const [bookingActionNotificationId, setBookingActionNotificationId] = useState<string | null>(null);
  const [bookedHoardingIds, setBookedHoardingIds] = useState<Record<string, boolean>>({});

  // Rate approval modal state
  const [rateApprovalModal, setRateApprovalModal] = useState<{
    open: boolean;
    action: "approve" | "reject";
    requestId: string;
    notificationId: string;
  } | null>(null);
  const [rateApprovalRemarks, setRateApprovalRemarks] = useState("");
  const [rateApprovalLoading, setRateApprovalLoading] = useState(false);
  const [processedRequestIds, setProcessedRequestIds] = useState<Record<string, "approved" | "rejected">>({});

  useEffect(() => { fetchNotifications(); }, [page]);

  useEffect(() => {
    if (!canAssignFitterFromNotifications) return;
    const run = async () => {
      try {
        setLoadingFitters(true);
        const resp = await bookingTokensAPI.fitters();
        setFitters(Array.isArray(resp?.data) ? resp.data : resp?.data || []);
      } catch (_) { setFitters([]); }
      finally { setLoadingFitters(false); }
    };
    run();
  }, [canAssignFitterFromNotifications]);

  useEffect(() => {
    const interval = setInterval(() => { fetchNotifications(true); }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchNotifications = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await notificationsAPI.getAll({ page, limit });
      if (response.success && response.data) {
        setNotifications(response.data.notifications || []);
        setTotal(response.data.total || 0);
      } else { setNotifications([]); setTotal(0); }
      if (!silent) setLoading(false);
    } catch {
      if (!silent) { setNotifications([]); setTotal(0); setLoading(false); }
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch { /* ignore */ }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await Promise.all(notifications.filter((n) => !n.read).map((n) => notificationsAPI.markAsRead(n.id)));
      fetchNotifications();
    } catch { /* ignore */ }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const isDesignCompletedNotification = (n: any) => String(n?.title || "").toLowerCase().includes("design completed");
  const isReadyToBookNotification = (n: any) => String(n?.title || "").toLowerCase().includes("hoarding is live");
  const isRateApprovalRequestNotification = (n: any) => String(n?.title || "").toLowerCase().includes("rate approval requested");

  const requestIdFromLink = (link?: string) => {
    try {
      return new URL(String(link || ""), "http://localhost").searchParams.get("requestId") || "";
    } catch {
      return String(link || "").match(/[?&]requestId=([^&]+)/i)?.[1] || "";
    }
  };

  const tokenIdFromLink = (link?: string) => String(link || "").match(/\/booking-tokens\/([^?]+)/i)?.[1] || "";
  const hoardingIdFromLink = (link?: string) => String(link || "").match(/\/hoardings\/([^?]+)/i)?.[1] || "";

  const markAsBooked = async (notification: any) => {
    const hoardingId = hoardingIdFromLink(notification?.link);
    if (!hoardingId) { showError("Invalid link for booking"); return; }
    if (bookedHoardingIds[String(hoardingId)]) return;
    try {
      setBookingActionNotificationId(String(notification.id));
      const resp = await hoardingsAPI.finalizeStatus(hoardingId, "booked");
      if (resp?.success) {
        showSuccess("Marked as booked");
        setBookedHoardingIds((prev) => ({ ...prev, [String(hoardingId)]: true }));
        fetchNotifications(true); return;
      }
      showError(resp?.message || "Failed to mark booked");
    } catch (e: any) {
      const msg = String(e?.response?.data?.message || "Failed to mark booked");
      if (Number(e?.response?.status) === 409) {
        showError(msg);
        setBookedHoardingIds((prev) => ({ ...prev, [String(hoardingId)]: true }));
        fetchNotifications(true); return;
      }
      showError(msg);
    } finally { setBookingActionNotificationId(null); }
  };

  const refreshTokenAssignment = async (tokenId: string) => {
    if (!tokenId) return;
    try {
      const resp = await bookingTokensAPI.getById(tokenId);
      const t = resp?.data;
      const fitterId = String(t?.fitterId || t?.fitter?.id || "");
      if (!fitterId) return;
      setAssignedFitterByTokenId((prev) => ({ ...prev, [String(tokenId)]: { fitterId, fitterName: t?.fitter?.name || undefined } }));
    } catch { /* ignore */ }
  };

  const getSelectedFitterId = (notificationId: string) => {
    return selectedFitterByNotification[notificationId] || (fitters.length === 1 ? String(fitters[0]?.id || "") : "");
  };

  const assignFitter = async (notification: any) => {
    const tokenId = tokenIdFromLink(notification?.link);
    if (!tokenId) { showError("Invalid link for fitter assignment"); return; }
    if (assignedFitterByTokenId[String(tokenId)]?.fitterId) { showError("This hoarding has already been assigned by another user."); return; }
    const fitterId = getSelectedFitterId(String(notification.id));
    if (fitters.length > 1 && !fitterId) { showError("Please select a fitter"); return; }
    try {
      setAssigningNotificationId(String(notification.id));
      const resp = await bookingTokensAPI.assignFitter(tokenId, fitterId ? { fitterId } : undefined);
      if (resp?.success) {
        showSuccess("Fitter assigned");
        const lockedId = fitterId || (fitters.length === 1 ? String(fitters[0]?.id || "") : "");
        const lockedName = fitters.find((f: any) => String(f?.id) === String(lockedId))?.name;
        if (lockedId) setAssignedFitterByTokenId((prev) => ({ ...prev, [String(tokenId)]: { fitterId: lockedId, fitterName: lockedName } }));
        else await refreshTokenAssignment(tokenId);
        fetchNotifications(true);
      } else { showError(resp?.message || "Failed to assign fitter"); }
    } catch (e: any) {
      const msg = String(e?.response?.data?.message || "Failed to assign fitter");
      const isAlreadyAssigned = Number(e?.response?.status) === 409 || (msg.toLowerCase().includes("already") && msg.toLowerCase().includes("assigned"));
      if (isAlreadyAssigned) { showError("This hoarding has already been assigned by another user."); await refreshTokenAssignment(tokenId); fetchNotifications(true); return; }
      showError(msg);
    } finally { setAssigningNotificationId(null); }
  };

  const openRateApprovalModal = (action: "approve" | "reject", requestId: string, notificationId: string, notification: any) => {
    if (!notification.read) handleMarkAsRead(notificationId);
    setRateApprovalRemarks("");
    setRateApprovalModal({ open: true, action, requestId, notificationId });
  };

  const handleRateApprovalAction = async () => {
    if (!rateApprovalModal) return;
    const { action, requestId } = rateApprovalModal;
    if (action === "reject" && !rateApprovalRemarks.trim()) { showError("Please enter a reason for rejection."); return; }
    try {
      setRateApprovalLoading(true);
      if (action === "approve") {
        await proposalsAPI.approveRateApproval(requestId, rateApprovalRemarks.trim() || undefined);
        showSuccess("Rate approved. The sales person has been notified.");
        setProcessedRequestIds((prev) => ({ ...prev, [requestId]: "approved" }));
      } else {
        await proposalsAPI.rejectRateApproval(requestId, rateApprovalRemarks.trim());
        showSuccess("Rate rejected. The sales person has been notified.");
        setProcessedRequestIds((prev) => ({ ...prev, [requestId]: "rejected" }));
      }
      setRateApprovalModal(null);
      fetchNotifications(true);
    } catch (e: any) {
      showError(String(e?.response?.data?.message || `Failed to ${action} rate approval`));
    } finally { setRateApprovalLoading(false); }
  };

  return (
    <div>
      <div
        className="notifications-page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}
      >
        <div>
          <h1>Notifications</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
            {unreadCount > 0 && <span style={{ color: "#ef4444", fontWeight: "600" }}>{unreadCount} unread</span>}{" "}
            {total} total
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-primary" onClick={handleMarkAllAsRead}>Mark All as Read</button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
            <p>Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔔</div>
            <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>No Notifications Yet</h3>
            <p>You're all caught up! New notifications will appear here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="notification-card"
                style={{
                  padding: "16px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  background: notification.read
                    ? "var(--bg-secondary)"
                    : isRateApprovalRequestNotification(notification) && canApproveRateFromNotifications
                    ? "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
                    : "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                  borderLeft: notification.read
                    ? "4px solid transparent"
                    : isRateApprovalRequestNotification(notification) && canApproveRateFromNotifications
                    ? "4px solid #7c3aed"
                    : "4px solid #f59e0b",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => {
                  if (!notification.read) handleMarkAsRead(notification.id);
                  if (notification.link && !(isRateApprovalRequestNotification(notification) && canApproveRateFromNotifications)) {
                    window.location.href = notification.link;
                  }
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(4px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateX(0)"; }}
              >
                <div className="notification-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 8px 0" }}>
                      {isRateApprovalRequestNotification(notification) && canApproveRateFromNotifications && (
                        <span style={{ display: "inline-block", background: "#7c3aed", color: "#fff", fontSize: "11px", fontWeight: 700, borderRadius: "4px", padding: "2px 6px", marginRight: "8px", verticalAlign: "middle" }}>
                          ACTION REQUIRED
                        </span>
                      )}
                      {notification.title}
                    </h4>
                    <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "14px" }}>
                      {notification.body}
                    </p>

                    {/* Rate Approval Action Buttons */}
                    {canApproveRateFromNotifications && isRateApprovalRequestNotification(notification) && (() => {
                      const requestId = requestIdFromLink(notification.link);
                      if (!requestId) return null;
                      const processed = processedRequestIds[requestId];
                      return (
                        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                          {processed ? (
                            <span style={{
                              padding: "6px 14px", borderRadius: "6px",
                              background: processed === "approved" ? "#d1fae5" : "#fee2e2",
                              color: processed === "approved" ? "#065f46" : "#991b1b",
                              fontWeight: 600, fontSize: "13px",
                              border: `1px solid ${processed === "approved" ? "#6ee7b7" : "#fca5a5"}`,
                            }}>
                              {processed === "approved" ? "✅ Approved" : "❌ Rejected"}
                            </span>
                          ) : (
                            <>
                              <button
                                className="btn btn-primary"
                                style={{ padding: "8px 16px", background: "linear-gradient(135deg, #059669, #10b981)", border: "none", fontSize: "13px" }}
                                onClick={() => openRateApprovalModal("approve", requestId, notification.id, notification)}
                              >
                                ✓ Approve Rate
                              </button>
                              <button
                                className="btn"
                                style={{ padding: "8px 16px", background: "linear-gradient(135deg, #dc2626, #ef4444)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
                                onClick={() => openRateApprovalModal("reject", requestId, notification.id, notification)}
                              >
                                ✗ Reject Rate
                              </button>
                              <a href={String(notification.link || "").split("?")[0]} style={{ color: "#7c3aed", fontSize: "13px", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
                                View Proposal →
                              </a>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* Mark as Booked */}
                    {canMarkBookedFromNotifications && isReadyToBookNotification(notification) && hoardingIdFromLink(notification.link) && (
                      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const hoardingId = hoardingIdFromLink(notification.link);
                          const booked = !!bookedHoardingIds[String(hoardingId)];
                          const busy = bookingActionNotificationId === String(notification.id);
                          return (
                            <button className="btn btn-primary" style={{ padding: "8px 12px" }} disabled={booked || busy} onClick={() => markAsBooked(notification)}>
                              {booked ? "Booked" : busy ? "Booking..." : "Mark as Booked"}
                            </button>
                          );
                        })()}
                      </div>
                    )}

                    {/* Assign Fitter */}
                    {canAssignFitterFromNotifications && !isReadyToBookNotification(notification) && isDesignCompletedNotification(notification) && tokenIdFromLink(notification.link) && (() => {
                      const tokenId = tokenIdFromLink(notification.link);
                      const assigned = assignedFitterByTokenId[String(tokenId)];
                      const assignedFitterId = String(assigned?.fitterId || "");
                      const locked = !!assignedFitterId;
                      return (
                        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ minWidth: 220 }}>
                            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Assign Fitter</label>
                            <select
                              className="input"
                              value={locked ? assignedFitterId : getSelectedFitterId(String(notification.id))}
                              onChange={(e) => setSelectedFitterByNotification((prev) => ({ ...prev, [String(notification.id)]: e.target.value }))}
                              disabled={loadingFitters || assigningNotificationId === String(notification.id) || locked}
                            >
                              <option value="">{loadingFitters ? "Loading..." : "Select fitter"}</option>
                              {fitters.map((f: any) => <option key={String(f.id)} value={String(f.id)}>{f.name}</option>)}
                            </select>
                          </div>
                          <button className="btn btn-primary" style={{ padding: "8px 12px" }} disabled={loadingFitters || assigningNotificationId === String(notification.id) || locked} onClick={() => assignFitter(notification)}>
                            {locked ? "Assigned" : "Assign Fitter"}
                          </button>
                        </div>
                      );
                    })()}

                    <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <span style={{
                      background: isRateApprovalRequestNotification(notification) && canApproveRateFromNotifications ? "#7c3aed" : "#ef4444",
                      width: "12px", height: "12px", borderRadius: "50%", flexShrink: 0, marginLeft: "12px",
                    }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {total > limit && (
        <div className="notifications-pagination" style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px" }}>
          <button className="btn btn-secondary" onClick={() => setPage(page - 1)} disabled={page === 1}>Previous</button>
          <span style={{ padding: "12px 24px", display: "flex", alignItems: "center" }}>Page {page} of {Math.ceil(total / limit)}</span>
          <button className="btn btn-secondary" onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(total / limit)}>Next</button>
        </div>
      )}

      {/* ── Rate Approval Modal (minimal & professional) ── */}
      {rateApprovalModal?.open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
          onClick={() => !rateApprovalLoading && setRateApprovalModal(null)}
        >
          <div
            style={{ background: "#fff", borderRadius: "12px", width: "100%", maxWidth: "420px", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", padding: "24px 24px 20px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                  background: rateApprovalModal.action === "approve" ? "#16a34a" : "#dc2626",
                }} />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                  {rateApprovalModal.action === "approve" ? "Approve Rate" : "Reject Rate"}
                </h3>
              </div>
              <button onClick={() => !rateApprovalLoading && setRateApprovalModal(null)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {/* Subtitle */}
            <p style={{ margin: "0 0 18px 16px", fontSize: "13px", color: "#6b7280" }}>
              {rateApprovalModal.action === "approve"
                ? "Sales person will be notified once approved."
                : "Sales person will need to re-submit for approval."}
            </p>

            <div style={{ borderTop: "1px solid #f3f4f6", marginBottom: "16px" }} />

            {/* Textarea */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>
                {rateApprovalModal.action === "reject"
                  ? <><span>Reason</span> <span style={{ color: "#dc2626" }}>*</span></>
                  : <><span>Remarks</span> <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span></>}
              </label>
              <textarea
                placeholder={rateApprovalModal.action === "reject" ? "Enter reason for rejection..." : "Add any notes or comments..."}
                value={rateApprovalRemarks}
                onChange={(e) => setRateApprovalRemarks(e.target.value)}
                rows={3}
                autoFocus
                style={{
                  width: "100%", resize: "vertical", fontSize: "14px", lineHeight: "1.5",
                  padding: "9px 12px", borderRadius: "8px", border: "1px solid #d1d5db",
                  outline: "none", color: "#111827", fontFamily: "inherit", boxSizing: "border-box",
                  background: "#fafafa", transition: "border-color 0.15s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#fff"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.background = "#fafafa"; }}
              />
              {rateApprovalModal.action === "reject" && !rateApprovalRemarks.trim() && (
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#dc2626" }}>Reason is required.</p>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                disabled={rateApprovalLoading}
                onClick={() => setRateApprovalModal(null)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: 500, fontSize: "14px", cursor: rateApprovalLoading ? "not-allowed" : "pointer", opacity: rateApprovalLoading ? 0.6 : 1, fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                disabled={rateApprovalLoading}
                onClick={handleRateApprovalAction}
                style={{
                  padding: "8px 20px", borderRadius: "8px", border: "none",
                  background: rateApprovalModal.action === "approve" ? "#16a34a" : "#dc2626",
                  color: "#fff", fontWeight: 600, fontSize: "14px",
                  cursor: rateApprovalLoading ? "not-allowed" : "pointer",
                  opacity: rateApprovalLoading ? 0.75 : 1, fontFamily: "inherit", minWidth: "100px",
                }}
              >
                {rateApprovalLoading ? "..." : rateApprovalModal.action === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          .notifications-page-header, .notifications-pagination {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .notification-card-head {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 10px;
          }
          .notifications-page-header :global(.btn), .notifications-pagination :global(.btn) { width: 100%; }
          .notification-card { padding: 14px !important; }
        }
      `}</style>
    </div>
  );
}
