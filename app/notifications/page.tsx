"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/components/AppLayout";
import { notificationsAPI } from "@/lib/api";

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationsAPI.getAll({ page, limit });
      if (response.success && response.data) {
        setNotifications(response.data.notifications || []);
        setTotal(response.data.total || 0);
      } else {
        setNotifications([]);
        setTotal(0);
      }
      setLoading(false); // Set loading to false immediately after setting data
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setNotifications([]);
      setTotal(0);
      setLoading(false); // Set loading to false on error too
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
