"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";

export default function AdminSettings() {
  const user = useUser();
  const router = useRouter();
  const [settings, setSettings] = useState({
    systemName: "Shubham Advertise",
    emailNotifications: true,
    smsNotifications: false,
    rentReminderDays: 7,
    sessionTimeout: 30,
  });

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const userRole = user?.role?.toLowerCase() || "";
  if (userRole !== "owner" && userRole !== "admin") {
    return <AccessDenied />;
  }

  const handleSaveSettings = () => {
    // In a real app, this would save to backend
    alert(
      "Settings saved successfully! (This is a demo - settings are not persisted)"
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1>Admin Settings</h1>
        <p
          style={{ color: "var(--text-secondary)", fontSize: 16, marginTop: 8 }}
        >
          Configure system-wide settings and preferences
        </p>
      </div>

      {/* General Settings */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>General Settings</h3>
        <div style={{ marginTop: 16 }}>
          <div className="form-group">
            <label>System Name</label>
            <input
              type="text"
              value={settings.systemName}
              onChange={(e) =>
                setSettings({ ...settings, systemName: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Session Timeout (minutes)</label>
            <input
              type="number"
              value={settings.sessionTimeout}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  sessionTimeout: parseInt(e.target.value) || 30,
                })
              }
              min={5}
              max={120}
            />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Notification Settings</h3>
        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "1fr 260px",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              Email Notifications
            </div>
            <div style={{ color: "var(--text-secondary)", marginTop: 6 }}>
              Send email alerts for bookings, contract updates and rent
              reminders. Recommended for managers and owners.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Enabled</span>
              <input
                aria-label="Enable email notifications"
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    emailNotifications: e.target.checked,
                  })
                }
                style={{ transform: "scale(1.25)" }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              SMS Notifications
            </div>
            <div style={{ color: "var(--text-secondary)", marginTop: 6 }}>
              Short SMS reminders for critical alerts such as expiring contracts
              and rent due notifications.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Enabled</span>
              <input
                aria-label="Enable sms notifications"
                type="checkbox"
                checked={settings.smsNotifications}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    smsNotifications: e.target.checked,
                  })
                }
                style={{ transform: "scale(1.25)" }}
              />
            </div>
          </div>

          {/* Rent reminder and preview placed below SMS in right column */}

          <div>
            <label style={{ display: "block", fontWeight: 700 }}>
              Rent Reminder Days
            </label>
            <input
              aria-label="Rent reminder days"
              type="number"
              value={settings.rentReminderDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  rentReminderDays: parseInt(e.target.value) || 1,
                })
              }
              min={1}
              max={30}
              style={{ width: 100, padding: "8px 10px", marginTop: 8 }}
              className="rounded rounded-xl"
            />

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Notification Preview
              </div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "#f5fbff",
                  border: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ fontWeight: 600 }}>Example</div>
                <div style={{ color: "var(--text-secondary)", marginTop: 6 }}>
                  If enabled, reminders will be sent {settings.rentReminderDays}{" "}
                  day(s) before the rent due date.
                </div>
              </div>
            </div>
          </div>
          <div />
        </div>
      </div>

      {/* System Management */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>System Management</h3>
        <div
          style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 20 }}
        >
          <button
            className="btn btn-primary"
            onClick={() => router.push("/users")}
          >
            Manage Users
          </button>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/roles")}
          >
            Manage Roles
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => alert("Database backup feature coming soon")}
          >
            Backup Database
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => alert("System logs feature coming soon")}
          >
            View System Logs
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card">
        <h3>Danger Zone</h3>
        <div style={{ marginTop: 20 }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
            These actions are irreversible. Please proceed with caution.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to clear all system cache? This action cannot be undone."
                  )
                ) {
                  alert(
                    "Cache cleared! (Demo mode - no actual action performed)"
                  );
                }
              }}
            >
              Clear System Cache
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to reset all settings to default? This action cannot be undone."
                  )
                ) {
                  setSettings({
                    systemName: "Shubham Advertise",
                    emailNotifications: true,
                    smsNotifications: false,
                    rentReminderDays: 7,
                    sessionTimeout: 30,
                  });
                  alert("Settings reset to default!");
                }
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 16 }}>
        <button className="btn btn-primary" onClick={handleSaveSettings}>
          💾 Save All Settings
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => router.push("/dashboard")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
