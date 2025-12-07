"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Tasks() {
  const user = useUser();
  const router = useRouter();

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute component="tasks">
      <div>
        <h1>Tasks</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
          Simplified tasks overview. Replace with full implementation if needed.
        </p>
      </div>
    </ProtectedRoute>
  );
}
