"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/components/AppLayout";
import { bookingTokensAPI, hoardingsAPI, notificationsAPI } from "@/lib/api";
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
  const [assigningNotificationId, setAssigningNotificationId] = useState<
    string | null
  >(null);
  const [selectedFitterByNotification, setSelectedFitterByNotification] =
    useState<Record<string, string>>({});
  const [assignedFitterByTokenId, setAssignedFitterByTokenId] = useState<
    Record<string, { fitterId: string; fitterName?: string }>
  >({});

  const roleLower = String(user?.role?.name || user?.role || "")
    .toLowerCase()
    .trim();
  const canAssignFitterFromNotifications = false;

  const canMarkBookedFromNotifications =
    roleLower === "owner" ||
    roleLower === "manager" ||
    roleLower === "sales" ||
    roleLower === "admin";

  const [bookingActionNotificationId, setBookingActionNotificationId] =
    useState<string | null>(null);
  const [bookedHoardingIds, setBookedHoardingIds] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  useEffect(() => {
    if (!canAssignFitterFromNotifications) return;
    const run = async () => {
      try {
        setLoadingFitters(true);
        const resp = await bookingTokensAPI.fitters();
        const rows = Array.isArray(resp?.data) ? resp.data : resp?.data || [];
        setFitters(rows);
      } catch (_) {
        setFitters([]);
      } finally {
        setLoadingFitters(false);
      }
    };
    run();
  }, [canAssignFitterFromNotifications]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchNotifications = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await notificationsAPI.getAll({ page, limit });
      if (response.success && response.data) {
        setNotifications(response.data.notifications || []);
        setTotal(response.data.total || 0);
      } else {
        setNotifications([]);
        setTotal(0);
      }
      if (!silent) setLoading(false); // Set loading to false immediately after setting data
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      if (!silent) {
        setNotifications([]);
        setTotal(0);
        setLoading(false); // Set loading to false on error too
      }
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsAPI.markAsRead(id);
      // Update local state
      setNotifications(
        notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unread = notifications.filter((n) => !n.read);
      await Promise.all(unread.map((n) => notificationsAPI.markAsRead(n.id)));
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  // Don't show loading spinner - show content immediately with empty state if needed

  const unreadCount = notifications.filter((n) => !n.read).length;

  const isDesignCompletedNotification = (n: any) => {
    const title = String(n?.title || "").toLowerCase();
    return title.includes("design completed");
  };

  const isReadyToBookNotification = (n: any) => {
    const title = String(n?.title || "").toLowerCase();
    return title.includes("hoarding is live");
  };

  const tokenIdFromLink = (link?: string) => {
    const s = String(link || "");
    const m = s.match(/\/booking-tokens\/([^?]+)/i);
    return m?.[1] ? String(m[1]) : "";
  };

  const hoardingIdFromLink = (link?: string) => {
    const s = String(link || "");
    const m = s.match(/\/hoardings\/([^?]+)/i);
    return m?.[1] ? String(m[1]) : "";
  };

  const markAsBooked = async (notification: any) => {
    const hoardingId = hoardingIdFromLink(notification?.link);
    if (!hoardingId) {
      showError("Invalid link for booking");
      return;
    }
    if (bookedHoardingIds[String(hoardingId)]) return;

    try {
      setBookingActionNotificationId(String(notification.id));
      const resp = await hoardingsAPI.finalizeStatus(hoardingId, "booked");
      if (resp?.success) {
        showSuccess("Marked as booked");
        setBookedHoardingIds((prev) => ({
          ...(prev || {}),
          [String(hoardingId)]: true,
        }));
        fetchNotifications(true);
        return;
      }
      showError(resp?.message || "Failed to mark booked");
    } catch (e: any) {
      const msg = String(e?.response?.data?.message || "Failed to mark booked");
      const status = Number(e?.response?.status || 0);
      if (status === 409) {
        showError(msg);
        setBookedHoardingIds((prev) => ({
          ...(prev || {}),
          [String(hoardingId)]: true,
        }));
        fetchNotifications(true);
        return;
      }
      showError(msg);
    } finally {
      setBookingActionNotificationId(null);
    }
  };

  const refreshTokenAssignment = async (tokenId: string) => {
    if (!tokenId) return;
    try {
      const resp = await bookingTokensAPI.getById(tokenId);
      const t = resp?.data;
      const fitterId = String(t?.fitterId || t?.fitter?.id || "");
      if (!fitterId) return;
      const fitterName = t?.fitter?.name ? String(t.fitter.name) : undefined;
      setAssignedFitterByTokenId((prev) => ({
        ...prev,
        [String(tokenId)]: { fitterId, fitterName },
      }));
    } catch (_) {
      // ignore
    }
  };

  const getSelectedFitterId = (notificationId: string) => {
    const existing = selectedFitterByNotification[notificationId];
    if (existing) return existing;
    if (fitters.length === 1) return String(fitters[0]?.id || "");
    return "";
  };

  const assignFitter = async (notification: any) => {
    const tokenId = tokenIdFromLink(notification?.link);
    if (!tokenId) {
      showError("Invalid link for fitter assignment");
      return;
    }

    // If already assigned (from local cache), lock UI.
    if (assignedFitterByTokenId[String(tokenId)]?.fitterId) {
      showError("This hoarding has already been assigned by another user.");
      return;
    }

    const fitterId = getSelectedFitterId(String(notification.id));
    if (fitters.length > 1 && !fitterId) {
      showError("Please select a fitter");
      return;
    }
    try {
      setAssigningNotificationId(String(notification.id));
      const resp = await bookingTokensAPI.assignFitter(
        tokenId,
        fitterId ? { fitterId } : undefined
      );
      if (resp?.success) {
        showSuccess("Fitter assigned");
        // Lock UI immediately
        const lockedId =
          fitterId ||
          (fitters.length === 1 ? String(fitters[0]?.id || "") : "");
        const lockedName =
          fitters.length === 1
            ? String(fitters[0]?.name || "")
            : fitters.find((f: any) => String(f?.id) === String(lockedId))
                ?.name;
        if (lockedId) {
          setAssignedFitterByTokenId((prev) => ({
            ...prev,
            [String(tokenId)]: {
              fitterId: String(lockedId),
              fitterName: lockedName ? String(lockedName) : undefined,
            },
          }));
        } else {
          // best-effort fetch to lock
          await refreshTokenAssignment(tokenId);
        }
        // refresh notifications (optional but keeps UI consistent)
        fetchNotifications(true);
      } else {
        showError(resp?.message || "Failed to assign fitter");
      }
    } catch (e: any) {
      const msg = String(
        e?.response?.data?.message || "Failed to assign fitter"
      );
      const status = Number(e?.response?.status || 0);
      const isAlreadyAssigned =
        status === 409 ||
        (msg.toLowerCase().includes("already") &&
          msg.toLowerCase().includes("assigned"));
      if (isAlreadyAssigned) {
        showError("This hoarding has already been assigned by another user.");
        await refreshTokenAssignment(tokenId);
        fetchNotifications(true);
        return;
      }
      showError(msg);
    } finally {
      setAssigningNotificationId(null);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1>Notifications</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
            {unreadCount > 0 && (
              <span style={{ color: "#ef4444", fontWeight: "600" }}>
                {unreadCount} unread
              </span>
            )}{" "}
            {total} total
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-primary" onClick={handleMarkAllAsRead}>
            Mark All as Read
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--text-secondary)",
            }}
          >
            <p>Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--text-secondary)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔔</div>
            <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>
              No Notifications Yet
            </h3>
            <p>You're all caught up! New notifications will appear here.</p>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  padding: "16px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  background: notification.read
                    ? "var(--bg-secondary)"
                    : "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                  borderLeft: notification.read
                    ? "4px solid transparent"
                    : "4px solid #f59e0b",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => {
                  if (!notification.read) {
                    handleMarkAsRead(notification.id);
                  }
                  if (notification.link) {
                    window.location.href = notification.link;
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateX(4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 8px 0" }}>
                      {notification.title}
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--text-secondary)",
                        fontSize: "14px",
                      }}
                    >
                      {notification.body}
                    </p>

                    {canMarkBookedFromNotifications &&
                      isReadyToBookNotification(notification) &&
                      hoardingIdFromLink(notification.link) && (
                        <div
                          style={{
                            marginTop: 12,
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                          onClick={(e) => {
                            // prevent card navigation
                            e.stopPropagation();
                          }}
                        >
                          {(() => {
                            const hoardingId = hoardingIdFromLink(
                              notification.link
                            );
                            const booked =
                              !!bookedHoardingIds[String(hoardingId)];
                            const busy =
                              bookingActionNotificationId ===
                              String(notification.id);
                            return (
                              <button
                                className="btn btn-primary"
                                style={{ padding: "8px 12px" }}
                                disabled={booked || busy}
                                onClick={() => markAsBooked(notification)}
                              >
                                {booked
                                  ? "Booked"
                                  : busy
                                  ? "Booking..."
                                  : "Mark as Booked"}
                              </button>
                            );
                          })()}
                        </div>
                      )}

                    {canAssignFitterFromNotifications &&
                      !isReadyToBookNotification(notification) &&
                      isDesignCompletedNotification(notification) &&
                      tokenIdFromLink(notification.link) &&
                      (() => {
                        const tokenId = tokenIdFromLink(notification.link);
                        const assigned =
                          assignedFitterByTokenId[String(tokenId)];
                        const assignedFitterId = String(
                          assigned?.fitterId || ""
                        );
                        const locked = !!assignedFitterId;
                        return (
                          <div
                            style={{
                              marginTop: 12,
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                              alignItems: "end",
                            }}
                            onClick={(e) => {
                              // prevent card navigation
                              e.stopPropagation();
                            }}
                          >
                            <div style={{ minWidth: 220 }}>
                              <label
                                style={{
                                  display: "block",
                                  fontSize: 12,
                                  marginBottom: 4,
                                }}
                              >
                                Assign Fitter
                              </label>
                              <select
                                className="input"
                                value={
                                  locked
                                    ? assignedFitterId
                                    : getSelectedFitterId(
                                        String(notification.id)
                                      )
                                }
                                onChange={(e) =>
                                  setSelectedFitterByNotification((prev) => ({
                                    ...prev,
                                    [String(notification.id)]: e.target.value,
                                  }))
                                }
                                disabled={
                                  loadingFitters ||
                                  assigningNotificationId ===
                                    String(notification.id) ||
                                  locked
                                }
                              >
                                <option value="">
                                  {loadingFitters
                                    ? "Loading..."
                                    : "Select fitter"}
                                </option>
                                {fitters.map((f: any) => (
                                  <option
                                    key={String(f.id)}
                                    value={String(f.id)}
                                  >
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              className="btn btn-primary"
                              style={{ padding: "8px 12px" }}
                              disabled={
                                loadingFitters ||
                                assigningNotificationId ===
                                  String(notification.id) ||
                                locked
                              }
                              onClick={() => assignFitter(notification)}
                            >
                              {locked ? "Assigned" : "Assign Fitter"}
                            </button>
                          </div>
                        );
                      })()}

                    <p
                      style={{
                        margin: "8px 0 0 0",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <span
                      style={{
                        background: "#ef4444",
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        flexShrink: 0,
                        marginLeft: "12px",
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {total > limit && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginTop: "24px",
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </button>
          <span
            style={{
              padding: "12px 24px",
              display: "flex",
              alignItems: "center",
            }}
          >
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(total / limit)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
