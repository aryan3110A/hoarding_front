"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/components/AppLayout";
import { hoardingsAPI, rentAPI } from "@/lib/api";
import { canUpdate, canDelete, getRoleFromUser, canViewRent } from "@/lib/rbac";

export default function HoardingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userFromContext = useUser();
  const [user, setUser] = useState<any>(null);
  const hoardingId = params.id as string;

  const [hoarding, setHoarding] = useState<any>(null);
  const [rent, setRent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load user from context or localStorage
  useEffect(() => {
    if (userFromContext) {
      setUser(userFromContext);
    } else {
      const localUser = localStorage.getItem("user");
      if (localUser) {
        try {
          setUser(JSON.parse(localUser));
        } catch (e) {
          console.error("Failed to parse user from localStorage", e);
        }
      }
    }
  }, [userFromContext]);

  useEffect(() => {
    fetchData();
  }, [hoardingId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch hoarding details
      const hoardingResponse = await hoardingsAPI.getById(hoardingId);
      if (hoardingResponse.success) {
        setHoarding(hoardingResponse.data);
      }

      // Fetch rent details if available
      try {
        const rentResponse = await rentAPI.getRentDetails(hoardingId);
        if (rentResponse.success && rentResponse.data) {
          setRent(rentResponse.data);
        }
      } catch (error: any) {
        // Rent not found is okay
        if (error.response?.status !== 404) {
          console.error("Error fetching rent:", error);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      alert("Failed to load hoarding details");
      router.push("/hoardings");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this hoarding?")) {
      return;
    }

    try {
      const response = await hoardingsAPI.delete(hoardingId);
      if (response.success) {
        alert("Hoarding deleted successfully!");
        router.push("/hoardings");
      } else {
        alert("Failed to delete: " + (response.message || "Unknown error"));
      }
    } catch (error: any) {
      alert(
        "Error deleting hoarding: " +
          (error.response?.data?.message || "Unknown error")
      );
    }
  };

  // Safely extract role from user object
  const userRole = getRoleFromUser(user);
  const canEdit = canUpdate(userRole, "hoardings");
  const canDeleteHoarding = canDelete(userRole, "hoardings");
  const canViewRentDetails = canViewRent(userRole);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
        <p>Loading hoarding details...</p>
      </div>
    );
  }

  if (!hoarding) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Hoarding not found</p>
        <Link href="/hoardings" className="btn btn-secondary">
          Back to Hoardings
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <button
          className="btn btn-secondary"
          onClick={() => router.back()}
          style={{ marginBottom: "16px" }}
        >
          ← Back
        </button>
        <h1>Hoarding Details</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
          <strong>{hoarding.code}</strong>
        </p>
      </div>

      <div className="card" style={{ marginBottom: "24px" }}>
        <h3>Basic Information</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px",
          }}
        >
          <div>
            <strong>Code:</strong> {hoarding.code}
          </div>
          <div>
            <strong>City:</strong> {hoarding.city || "N/A"}
          </div>
          <div>
            <strong>Area/Zone:</strong> {hoarding.area || "N/A"}
          </div>
          <div>
            <strong>Landmark:</strong> {hoarding.landmark || "N/A"}
          </div>
          <div>
            <strong>Road Name:</strong> {hoarding.roadName || "N/A"}
          </div>
          <div>
            <strong>Side:</strong> {hoarding.side || "N/A"}
          </div>
          <div>
            <strong>Size:</strong>{" "}
            {hoarding.widthCm && hoarding.heightCm
              ? `${Math.round(hoarding.widthCm / 30.48)}ft x ${Math.round(
                  hoarding.heightCm / 30.48
                )}ft`
              : "N/A"}
          </div>
          <div>
            <strong>Type:</strong> {hoarding.type || "N/A"}
          </div>
          <div>
            <strong>Ownership:</strong> {hoarding.ownership || "N/A"}
          </div>
          <div>
            <strong>Status:</strong>{" "}
            <span
              className={`badge ${
                hoarding.status === "available"
                  ? "badge-success"
                  : hoarding.status === "on_rent"
                  ? "badge-danger"
                  : "badge-warning"
              }`}
            >
              {hoarding.status === "on_rent" ? "On Rent" : hoarding.status}
            </span>
          </div>
          <div>
            <strong>Base Rate:</strong>{" "}
            {hoarding.baseRate
              ? `₹${Number(hoarding.baseRate).toLocaleString()}`
              : "N/A"}
          </div>
          {hoarding.lat && hoarding.lng && (
            <div>
              <strong>Location:</strong> {hoarding.lat}, {hoarding.lng}
            </div>
          )}
        </div>
      </div>

      {rent && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <h3>Rent Information</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "16px",
            }}
          >
            <div>
              <strong>Rent Amount:</strong> ₹
              {Number(rent.rentAmount).toLocaleString()}
            </div>
            <div>
              <strong>Party Type:</strong> {rent.partyType}
            </div>
            <div>
              <strong>Payment Mode:</strong> {rent.paymentMode}
            </div>
            {rent.nextDueDate && (
              <div>
                <strong>Next Due Date:</strong>{" "}
                {new Date(rent.nextDueDate).toLocaleDateString()}
              </div>
            )}
            {rent.incrementYear && (
              <div>
                <strong>Increment Year:</strong> {rent.incrementYear}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
        {canViewRentDetails && (
          <Link
            href={`/hoardings/${hoardingId}/rent`}
            className="btn btn-primary"
            style={{
              backgroundColor: "#f59e0b",
              borderColor: "#f59e0b",
            }}
          >
            {hoarding.status === "on_rent" ? "View Rent" : "Rent"}
          </Link>
        )}
        {canEdit && (
          <Link
            href={`/hoardings/${hoardingId}/edit`}
            className="btn btn-warning"
          >
            Edit
          </Link>
        )}
        {canDeleteHoarding && (
          <button className="btn btn-danger" onClick={handleDelete}>
            Delete
          </button>
        )}
        <Link href="/hoardings" className="btn btn-secondary">
          Back to List
        </Link>
      </div>
    </div>
  );
}
