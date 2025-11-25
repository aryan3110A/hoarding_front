"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/api";

// Simple UUID generator (no external dependency needed)
function generateDeviceId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Generate or get device ID
      let deviceId = localStorage.getItem("deviceId");
      if (!deviceId) {
        deviceId = generateDeviceId();
        localStorage.setItem("deviceId", deviceId);
      }

      // Trim inputs to prevent whitespace issues
      const trimmedEmail = emailOrPhone.trim();
      const trimmedPassword = password.trim();

      if (!trimmedEmail || !trimmedPassword) {
        setError("Please enter both email and password");
        setLoading(false);
        return;
      }

      const response = await authAPI.login(
        trimmedEmail,
        trimmedPassword,
        deviceId
      );

      console.log(response, "response");

      if (response.success && response.data) {
        console.log("here");
        // Store tokens and user data
        localStorage.setItem("token", response.data.accessToken);
        localStorage.setItem("refreshToken", response.data.refreshToken);
        localStorage.setItem("user", JSON.stringify(response.data.user));

        router.push("/dashboard");
      } else {
        setError(response.message || "Login failed");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Shubham Advertise</h1>
        <h2>Hoarding Management System</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email or Phone</label>
            <input
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="Enter your email or phone number"
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "8px" }}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            background: "#f8fafc",
            borderRadius: "8px",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "#64748b",
              textAlign: "center",
              margin: 0,
              fontWeight: "600",
            }}
          >
            <strong>Demo Test Accounts (Password: Password@123):</strong>
          </p>
          <div
            style={{
              marginTop: "12px",
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "8px",
              fontSize: "11px",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <strong>Owner:</strong> owner@demo.com
            </div>
            <div style={{ textAlign: "left" }}>
              <strong>Manager:</strong> manager@demo.com
            </div>
            <div style={{ textAlign: "left" }}>
              <strong>Sales:</strong> sales@demo.com
            </div>
            <div style={{ textAlign: "left" }}>
              <strong>Designer:</strong> designer@demo.com
            </div>
            <div style={{ textAlign: "left" }}>
              <strong>Fitter:</strong> fitter@demo.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
