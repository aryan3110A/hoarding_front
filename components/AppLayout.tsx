"use client";

import { useEffect, useRef, useState, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Toast from "./Toast";
import { getRoleFromUser } from "@/lib/rbac";
import { authAPI, devicesAPI } from "@/lib/api";

interface AppLayoutProps {
  children: React.ReactNode;
}

const UserContext = createContext<any>(null);

const SALES_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const SALES_LOCATION_PING_INTERVAL_MS = 2 * 60 * 1000;
const SALES_IDLE_STORAGE_KEY = "salesLastActivityAt";
const SALES_IDLE_EVENTS: Array<keyof WindowEventMap> = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
];

export const useUser = () => useContext(UserContext);

const getDefaultRouteForRole = (role?: string | null) => {
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  return normalizedRole === "accountant"
    ? "/dashboard/accountant"
    : "/dashboard";
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const idleTimeoutRef = useRef<number | null>(null);
  const sessionPollIntervalRef = useRef<number | null>(null);
  const locationPingIntervalRef = useRef<number | null>(null);
  const inactivityLogoutRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  const clearStoredAuth = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem(SALES_IDLE_STORAGE_KEY);
  };

  const notifyServerLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) return;

      await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/auth/logout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        },
      );
    } catch (error) {
      // Ignore logout API failures and clear the local session anyway.
    }
  };

  const finishLogout = () => {
    if (idleTimeoutRef.current) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    setUser(null);
    setLoading(false);
    clearStoredAuth();
    router.push("/login");
  };

  const readSalesActivityState = () => {
    try {
      const rawValue = localStorage.getItem(SALES_IDLE_STORAGE_KEY);
      if (!rawValue) return null;

      const parsedValue = JSON.parse(rawValue) as {
        token?: string;
        lastActivityAt?: number;
      };

      const lastActivityAt = Number(parsedValue?.lastActivityAt || 0);
      const token = String(parsedValue?.token || "");
      if (!token || !Number.isFinite(lastActivityAt) || lastActivityAt <= 0) {
        return null;
      }

      return { token, lastActivityAt };
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    // Re-evaluate auth state on route change as well
    console.log("👤 [AppLayout] Checking auth state for", pathname);
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    // If token & user exist, populate context
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setLoading(false);
        // If we are on /login but already authenticated, go to dashboard
        if (pathname === "/login") {
          router.replace(getDefaultRouteForRole(parsedUser?.role));
        }
        return;
      } catch (e) {
        console.error("👤 [AppLayout] Failed to parse user from storage", e);
        setUser(null);
        setLoading(false);
      }
    }

    // No token/user – if on login, just render the page; otherwise redirect
    setUser(null);
    setLoading(false);
    if (pathname !== "/login") {
      router.replace("/login");
    }
  }, [pathname, router]);

  useEffect(() => {
    const roleName = String(getRoleFromUser(user) || "").toLowerCase();
    const isSalesUser = roleName === "sales";

    if (!isSalesUser || pathname === "/login") {
      inactivityLogoutRef.current = false;
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      return;
    }

    const runInactivityLogout = async () => {
      if (inactivityLogoutRef.current) return;
      inactivityLogoutRef.current = true;
      await notifyServerLogout();
      finishLogout();
    };

    const scheduleLogout = (lastActivityAt: number) => {
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
      }

      const remainingMs = SALES_IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt);
      if (remainingMs <= 0) {
        void runInactivityLogout();
        return;
      }

      idleTimeoutRef.current = window.setTimeout(() => {
        void runInactivityLogout();
      }, remainingMs);
    };

    const resetTimer = () => {
      const now = Date.now();
      localStorage.setItem(
        SALES_IDLE_STORAGE_KEY,
        JSON.stringify({
          token: localStorage.getItem("token") || "",
          lastActivityAt: now,
        }),
      );
      scheduleLogout(now);
    };

    const syncTimerFromStorage = () => {
      const currentToken = String(localStorage.getItem("token") || "");
      const storedState = readSalesActivityState();

      if (storedState && storedState.token === currentToken) {
        if (Date.now() - storedState.lastActivityAt >= SALES_IDLE_TIMEOUT_MS) {
          void runInactivityLogout();
          return;
        }
        scheduleLogout(storedState.lastActivityAt);
        return;
      }

      resetTimer();
    };

    const handleActivity = () => {
      if (!document.hidden) {
        resetTimer();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncTimerFromStorage();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SALES_IDLE_STORAGE_KEY && !document.hidden) {
        syncTimerFromStorage();
      }
    };

    syncTimerFromStorage();

    for (const eventName of SALES_IDLE_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      for (const eventName of SALES_IDLE_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorage);
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
    };
  }, [pathname, router, user]);

  useEffect(() => {
    const roleName = String(getRoleFromUser(user) || "").toLowerCase();
    const isSalesUser = roleName === "sales";

    if (!isSalesUser || pathname === "/login") {
      if (sessionPollIntervalRef.current) {
        window.clearInterval(sessionPollIntervalRef.current);
        sessionPollIntervalRef.current = null;
      }
      return;
    }

    const checkCurrentSession = async () => {
      try {
        await authAPI.getSession();
      } catch (error) {
        // 401 handling is centralized in the API interceptor and will redirect on revoked sessions.
      }
    };

    void checkCurrentSession();
    sessionPollIntervalRef.current = window.setInterval(() => {
      void checkCurrentSession();
    }, 60 * 1000);

    return () => {
      if (sessionPollIntervalRef.current) {
        window.clearInterval(sessionPollIntervalRef.current);
        sessionPollIntervalRef.current = null;
      }
    };
  }, [pathname, user]);

  useEffect(() => {
    const roleName = String(getRoleFromUser(user) || "").toLowerCase();
    const isSalesUser = roleName === "sales";

    if (!isSalesUser || pathname === "/login") {
      if (locationPingIntervalRef.current) {
        window.clearInterval(locationPingIntervalRef.current);
        locationPingIntervalRef.current = null;
      }
      return;
    }

    const deviceId = String(localStorage.getItem("deviceId") || "").trim();
    if (
      !deviceId ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      return;
    }

    const sendCurrentLocation = () => {
      if (document.hidden) return;

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
          } catch (error) {
            // Ignore upload failures to avoid disrupting the session.
          }
        },
        () => {
          // Ignore permission denial and temporary location lookup failures.
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        },
      );
    };

    sendCurrentLocation();
    locationPingIntervalRef.current = window.setInterval(() => {
      sendCurrentLocation();
    }, SALES_LOCATION_PING_INTERVAL_MS);

    return () => {
      if (locationPingIntervalRef.current) {
        window.clearInterval(locationPingIntervalRef.current);
        locationPingIntervalRef.current = null;
      }
    };
  }, [pathname, user]);

  const handleLogout = async () => {
    try {
      await notifyServerLogout();
    } catch (error) {
      // Ignore errors
    } finally {
      finishLogout();
    }
  };

  // While evaluating, show a small loader (except we already allow login to render below)
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // On login route, render page even if not authenticated
  if (pathname === "/login" && !user) {
    return <>{children}</>;
  }

  // For protected routes, if user is still missing, render nothing (redirect fired above)
  if (!user) return null;

  return (
    <UserContext.Provider value={user}>
      <div className="app-layout">
        <Toast />
        <Navbar user={user} onLogout={handleLogout} />
        <main className="main-content">
          <div className="content-wrapper">{children}</div>
        </main>
      </div>
    </UserContext.Provider>
  );
}
