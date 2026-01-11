"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";
import { showSuccess, showError } from "@/lib/toast";

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
      const list = Array.isArray(contractsData) ? contractsData : [];

      // Use denormalized fields `clientName` and `hoardingCode` when available to avoid N+1 fetches.
      setContracts(
        list.map((c: any) => ({
          ...c,
          clientName: c.clientName || null,
          hoardingCode: c.hoardingCode || null,
        }))
      );
      setLoading(false); // Set loading to false immediately after setting data
    } catch (error) {
      console.error("Failed to fetch contracts:", error);
      setContracts([]);
      setLoading(false); // Set loading to false on error too
    }
  };

  const handleRenew = async (contractId: string) => {
    try {
      const authToken = localStorage.getItem("token");
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const resp = await axios.post(
        `${API_URL}/api/contracts/${contractId}/renew`,
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      showSuccess("Renewal requested/created");
      fetchData();
    } catch (err) {
      console.error(err);
      showError("Failed to renew contract");
    }
  };

  const handleCancel = async (contractId: string) => {
    if (!confirm("Are you sure you want to cancel this contract?")) return;
    try {
      const authToken = localStorage.getItem("token");
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      await axios.post(
        `${API_URL}/api/contracts/${contractId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      showSuccess("Contract cancelled");
      fetchData();
    } catch (err) {
      console.error(err);
      showError("Failed to cancel contract");
    }
  };

  const handleRequestRenew = async (contractId: string) => {
    try {
      const authToken = localStorage.getItem("token");
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      await axios.post(
        `${API_URL}/api/contracts/${contractId}/renew`,
        { requestOnly: true },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      showSuccess("Renewal request submitted");
      fetchData();
    } catch (err) {
      console.error(err);
      showError("Failed to request renewal");
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const userRole = user?.role?.toLowerCase() || "";
  if (!["owner", "manager", "admin", "sales"].includes(userRole)) {
    return <AccessDenied />;
  }

  // Don't show loading spinner - show content immediately with empty state if needed

  return (
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
              {contracts
                .filter((contract: any) => {
                  if (userRole === "sales") {
                    // Sales see only contracts they created/assigned to
                    return (
                      String(contract.createdById) === String(user?.id) ||
                      String(contract.salesUserId) === String(user?.id)
                    );
                  }
                  return true;
                })
                .map((contract: any) => (
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
                    <td>
                      {/* Role-based actions */}
                      {["owner", "admin"].includes(userRole) && (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleRenew(contract.id)}
                          >
                            Renew
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleCancel(contract.id)}
                            style={{ marginLeft: 8 }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {userRole === "manager" && (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleRenew(contract.id)}
                          >
                            Renew
                          </button>
                          <button
                            className="btn btn-sm"
                            disabled
                            style={{ marginLeft: 8 }}
                          >
                            Cancel (restricted)
                          </button>
                        </>
                      )}
                      {userRole === "sales" &&
                        String(contract.createdById) === String(user?.id) && (
                          <button
                            className="btn btn-sm"
                            onClick={() => handleRequestRenew(contract.id)}
                          >
                            Request Renew
                          </button>
                        )}
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
  );
}
