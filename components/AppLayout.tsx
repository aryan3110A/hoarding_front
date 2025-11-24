"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import Navbar from "./Navbar";

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
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
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
        <Navbar user={user} onLogout={handleLogout} />
        <main className="main-content">
          <div className="content-wrapper">{children}</div>
        </main>
      </div>
    </UserContext.Provider>
  );
}
