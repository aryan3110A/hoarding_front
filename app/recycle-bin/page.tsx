"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import { recycleBinAPI } from "@/lib/api";
import { getRoleFromUser } from "@/lib/rbac";
import ProtectedRoute from "@/components/ProtectedRoute";
import { showError, showSuccess } from "@/lib/toast";

export default function RecycleBinPage() {
  const router = useRouter();
  const userFromContext = useUser();
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (userFromContext) {
      setUser(userFromContext);
    } else {
      const localUser = localStorage.getItem("user");
      if (localUser) {
        try {
          setUser(JSON.parse(localUser));
        } catch (_) {}
      }
    }
  }, [userFromContext]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await recycleBinAPI.list();
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to load recycle bin items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const role = String(getRoleFromUser(user) || "").toLowerCase();
      if (!["owner", "admin"].includes(role)) {
        showError("Access Denied: Only Owner and Admin can access the Recycle Bin");
        router.push("/dashboard");
        return;
      }
      loadItems();
    }
  }, [user]);

  const handleRestore = async (hoardingId: string) => {
    try {
      setActioningId(hoardingId);
      await recycleBinAPI.restore(hoardingId);
      showSuccess("Hoarding successfully restored from Recycle Bin");
      loadItems();
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to restore hoarding");
    } finally {
      setActioningId(null);
    }
  };

  const handlePurge = async (hoardingId: string) => {
    const ok = window.confirm("Are you sure you want to permanently delete this hoarding? This action cannot be undone.");
    if (!ok) return;

    try {
      setActioningId(hoardingId);
      await recycleBinAPI.purge(hoardingId);
      showSuccess("Hoarding permanently deleted");
      loadItems();
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to permanently delete hoarding");
    } finally {
      setActioningId(null);
    }
  };

  const formatDate = (value: unknown) => {
    if (!value) return "N/A";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <ProtectedRoute component="hoardings">
      <div className="container" style={{ padding: "24px 0" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ color: "#ffffff" }}>Recycle Bin</h1>
          <p style={{ color: "rgba(255, 255, 255, 0.8)", marginTop: "8px" }}>
            View and manage soft-deleted hoardings. Deleted items are kept here for 30 days before being permanently removed.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
            <p style={{ marginTop: "12px", color: "rgba(255, 255, 255, 0.8)" }}>Loading recycle bin items...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "48px 24px", background: "white", borderRadius: "12px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>♻️</div>
            <h3 style={{ color: "var(--text-primary)", margin: 0 }}>Recycle Bin is Empty</h3>
            <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>No soft-deleted hoardings were found.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {items.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                  padding: "20px 24px",
                  margin: 0,
                  background: "white",
                  borderRadius: "12px"
                }}
              >
                <div>
                  <h3 style={{ margin: 0, color: "var(--text-primary)" }}>
                    {item.code} {item.side ? `(${item.side})` : ""}
                  </h3>
                  <div
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "13px",
                      marginTop: "6px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "16px",
                    }}
                  >
                    <span>
                      📍 <strong>Location:</strong> {item.landmark || item.area || item.city || "—"}
                    </span>
                    <span>
                      📅 <strong>Deleted on:</strong> {formatDate(item.deletedAt)}
                    </span>
                    <span style={{ color: item.daysRemaining <= 5 ? "var(--danger-color)" : "inherit" }}>
                      ⏰ <strong>Auto-purging in:</strong> {item.daysRemaining} days
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="btn btn-success"
                    onClick={() => handleRestore(item.hoardingId)}
                    disabled={actioningId === item.hoardingId}
                  >
                    {actioningId === item.hoardingId ? "Restoring..." : "Restore"}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handlePurge(item.hoardingId)}
                    disabled={actioningId === item.hoardingId}
                  >
                    {actioningId === item.hoardingId ? "Deleting..." : "Delete Permanently"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
