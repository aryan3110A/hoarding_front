"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout, { useUser } from "@/components/AppLayout";
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
      <AppLayout>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Loading...</p>
        </div>
      </AppLayout>
    );
  }

  const userRole = user?.role?.toLowerCase() || "";
  if (userRole !== "owner" && userRole !== "admin") {
    return <AccessDenied />;
  }

  const handleSaveSettings = () => {
    // In a real app, this would save to backend
    alert("Settings saved successfully! (This is a demo - settings are not persisted)");
  };

  return (
    <AppLayout>
      <div>
        <div style={{ marginBottom: "32px" }}>
          <h1>Admin Settings</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "16px", marginTop: "8px" }}>
            Configure system-wide settings and preferences
          </p>
        </div>

        <div className="card" style={{ marginBottom: "24px" }}>
          <h3>General Settings</h3>
          <div style={{ marginTop: "20px" }}>
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
                min="5"
                max="120"
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: "24px" }}>
          <h3>Notification Settings</h3>
          <div style={{ marginTop: "20px" }}>
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      emailNotifications: e.target.checked,
                    })
                  }
                />
                Enable Email Notifications
              </label>
            </div>
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  checked={settings.smsNotifications}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      smsNotifications: e.target.checked,
                    })
                  }
                />
                Enable SMS Notifications
              </label>
            </div>
            <div className="form-group">
              <label>Rent Reminder Days (before due date)</label>
              <input
                type="number"
                value={settings.rentReminderDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rentReminderDays: parseInt(e.target.value) || 7,
                  })
                }
                min="1"
                max="30"
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: "24px" }}>
          <h3>System Management</h3>
          <div
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              marginTop: "20px",
            }}
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

        <div className="card">
          <h3>Danger Zone</h3>
          <div style={{ marginTop: "20px" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
              These actions are irreversible. Please proceed with caution.
            </p>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to clear all system cache? This action cannot be undone."
                    )
                  ) {
                    alert("Cache cleared! (Demo mode - no actual action performed)");
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

        <div style={{ marginTop: "24px", display: "flex", gap: "16px" }}>
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
    </AppLayout>
  );
}

