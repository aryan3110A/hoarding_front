"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const getDefaultRouteForRole = (role?: string | null) => {
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  return normalizedRole === "accountant"
    ? "/dashboard/accountant"
    : "/dashboard";
};

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    if (token) {
      try {
        const parsedUser = user ? JSON.parse(user) : null;
        router.push(getDefaultRouteForRole(parsedUser?.role));
      } catch {
        router.push("/dashboard");
      }
    } else {
      router.push("/login");
    }
  }, [router]);

  return <div>Loading...</div>;
}
