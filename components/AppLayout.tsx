"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Toast from "./Toast";

interface AppLayoutProps {
  children: React.ReactNode;
}

const UserContext = createContext<any>(null);

export const useUser = () => useContext(UserContext);

export default function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

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
          router.replace("/dashboard");
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

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        // Try to logout on server (don't wait for response)
        fetch(
          `${
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
          }/api/auth/logout`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          }
        ).catch(() => {
          // Ignore errors
        });
      }
    } catch (error) {
      // Ignore errors
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      router.push("/login");
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
