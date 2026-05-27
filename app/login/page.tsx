"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authAPI, devicesAPI } from "@/lib/api";
import { showInfo } from "@/lib/toast";

// Simple UUID generator (no external dependency needed)
function generateDeviceId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function buildDeviceMeta(): { deviceName?: string; platform?: string } {
  if (typeof window === "undefined") {
    return {};
  }

  const userAgent = window.navigator.userAgent || "";
  const platform =
    (
      window.navigator as Navigator & {
        userAgentData?: { platform?: string };
      }
    ).userAgentData?.platform ||
    window.navigator.platform ||
    "";

  const ua = userAgent.toLowerCase();
  const normalizedPlatform = String(platform || "").trim();
  const isTablet =
    ua.includes("ipad") || (ua.includes("android") && !ua.includes("mobile"));
  const isPhone =
    ua.includes("iphone") || (ua.includes("android") && ua.includes("mobile"));

  let deviceName = "Other Device";
  if (isTablet) {
    deviceName = `${normalizedPlatform || "Tablet"} Tablet`;
  } else if (isPhone) {
    deviceName = `${normalizedPlatform || "Mobile"} Phone`;
  } else if (normalizedPlatform) {
    deviceName = `${normalizedPlatform} PC`;
  }

  return {
    deviceName,
    platform: normalizedPlatform || undefined,
  };
}

function getDefaultRouteForRole(role?: string | null): string {
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  return normalizedRole === "accountant"
    ? "/dashboard/accountant"
    : "/dashboard";
}

function requestSalesLocationPermission(deviceId: string) {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return;
  }

  if (!navigator.geolocation) {
    showInfo("Location tracking is not available in this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        await devicesAPI.ping(deviceId, {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy)
            : undefined,
        });
      } catch {
        // Ignore initial upload failures; the background tracker will retry.
      }
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        showInfo(
          "Please allow browser location permission for sales login so the owner can see your latest coordinates.",
        );
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    },
  );
}

export default function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // If already authenticated, go straight to dashboard
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    if (token && user) {
      try {
        const parsedUser = JSON.parse(user);
        router.replace(getDefaultRouteForRole(parsedUser?.role));
      } catch {
        router.replace("/dashboard");
      }
    }
  }

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
        deviceId,
        buildDeviceMeta(),
      );

      console.log(response, "response");

      if (response.success && response.data) {
        console.log("here");
        // Store tokens and user data
        localStorage.setItem("token", response.data.accessToken);
        localStorage.setItem("refreshToken", response.data.refreshToken);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        sessionStorage.setItem(
          "dashboardWelcomeToast",
          JSON.stringify({
            name: response.data.user?.name || null,
            role: response.data.user?.role || null,
          }),
        );

        const roleName = String(response.data.user?.role || "").toLowerCase();
        if (roleName === "sales") {
          requestSalesLocationPermission(deviceId);
        }

        router.push(getDefaultRouteForRole(response.data.user?.role));
      } else {
        setError(response.message || "Login failed");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Login failed. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div
          style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}
        >
          <img
            src="/LOGO_SHUBHAM_ADVERTISE_FINAL_PNG.png"
            alt="Shubham Advertise"
            className="login-logo"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (!img.dataset.fallback) {
                img.dataset.fallback = "1";
                img.src = "/shubham-logo.svg";
              }
            }}
          />
        </div>
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
        {/* <div
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
              <strong>Supervisor:</strong> supervisor@demo.com
            </div>
              <div style={{ textAlign: "left" }}>
                <strong>Accountant:</strong> accountant@demo.com
              </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
