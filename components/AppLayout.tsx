"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    console.log("👤 [AppLayout] Initializing user context...");
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("👤 [AppLayout] No token found, redirecting to login");
      router.push("/login");
      return;
    }

    const userData = localStorage.getItem("user");
    console.log("👤 [AppLayout] Raw userData from localStorage:", userData);
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        console.log("👤 [AppLayout] Parsed user object:", parsedUser);
        console.log(
          "👤 [AppLayout] User object keys:",
          Object.keys(parsedUser)
        );
        console.log("👤 [AppLayout] User role property:", parsedUser.role);
        console.log(
          "👤 [AppLayout] Full user object:",
          JSON.stringify(parsedUser, null, 2)
        );
        setUser(parsedUser);
        console.log("👤 [AppLayout] User state set, setting loading to false");
        setLoading(false);
      } catch (error) {
        console.error("👤 [AppLayout] Error parsing user data:", error);
        setLoading(false);
      }
    } else {
      console.warn("👤 [AppLayout] No user data found in localStorage");
      setLoading(false);
    }
  }, [router]);

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

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
