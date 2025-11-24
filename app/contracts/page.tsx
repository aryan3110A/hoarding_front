"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import AppLayout, { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";

export default function Contracts() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUser();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem("token");
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await axios.get(`${API_URL}/api/contracts`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const contractsData = response.data?.data || response.data || [];
      setContracts(Array.isArray(contractsData) ? contractsData : []);
      setLoading(false); // Set loading to false immediately after setting data
    } catch (error) {
      console.error("Failed to fetch contracts:", error);
      setContracts([]);
      setLoading(false); // Set loading to false on error too
    }
  };

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
  if (!["owner", "manager", "admin"].includes(userRole)) {
    return <AccessDenied />;
  }

  // Don't show loading spinner - show content immediately with empty state if needed

  return (
    <AppLayout>
      <div>
        <h1 style={{ marginBottom: "20px" }}>Contracts</h1>
        <div className="card">
          <h3>All Contracts</h3>
          {contracts.length > 0 ? (
            <table className="table" style={{ marginTop: "16px" }}>
              <thead>
                <tr>
                  <th>Contract ID</th>
                  <th>Client</th>
                  <th>Hoarding</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract: any) => (
                  <tr key={contract.id}>
                    <td>{contract.id}</td>
                    <td>{contract.clientName || "N/A"}</td>
                    <td>{contract.hoardingCode || "N/A"}</td>
                    <td>
                      {contract.startDate
                        ? new Date(contract.startDate).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td>
                      {contract.endDate
                        ? new Date(contract.endDate).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {contract.status || "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📄</div>
              <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>
                No Contracts Yet
              </h3>
              <p>
                Contracts will appear here once bookings are converted to
                contracts.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
