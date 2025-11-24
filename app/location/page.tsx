"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import AppLayout, { useUser } from "@/components/AppLayout";

export default function Location() {
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUser();
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [checkInData, setCheckInData] = useState({
    latitude: "",
    longitude: "",
    notes: "",
  });
  const router = useRouter();

  useEffect(() => {
    if (user) {
      fetchCheckIns();

      // Try to get current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCheckInData({
              ...checkInData,
              latitude: position.coords.latitude.toString(),
              longitude: position.coords.longitude.toString(),
            });
          },
          (error) => {
            console.error("Error getting location:", error);
          }
        );
      }
    }
  }, [user]);

  const fetchCheckIns = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/location/checkins`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const checkInsData = response.data?.data || response.data || [];
      setCheckIns(Array.isArray(checkInsData) ? checkInsData : []);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch check-ins:", error);
      setCheckIns([]);
      setLoading(false);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/location/checkin`,
        {
          ...checkInData,
          latitude: parseFloat(checkInData.latitude),
          longitude: parseFloat(checkInData.longitude),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setShowCheckInForm(false);
      setCheckInData({ latitude: "", longitude: "", notes: "" });
      fetchCheckIns();
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to check in");
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
  const isSales = userRole === "sales";

  return (
    <AppLayout>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h1>Location Tracking</h1>
          {isSales && (
            <button
              onClick={() => setShowCheckInForm(!showCheckInForm)}
              className="btn btn-primary"
            >
              {showCheckInForm ? "Cancel" : "Check In"}
            </button>
          )}
        </div>

        {showCheckInForm && isSales && (
          <div className="card">
            <h3>Check In</h3>
            <form onSubmit={handleCheckIn}>
              <div className="form-group">
                <label>Latitude *</label>
                <input
                  type="number"
                  step="any"
                  value={checkInData.latitude}
                  onChange={(e) =>
                    setCheckInData({ ...checkInData, latitude: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Longitude *</label>
                <input
                  type="number"
                  step="any"
                  value={checkInData.longitude}
                  onChange={(e) =>
                    setCheckInData({
                      ...checkInData,
                      longitude: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={checkInData.notes}
                  onChange={(e) =>
                    setCheckInData({ ...checkInData, notes: e.target.value })
                  }
                  rows={3}
                  placeholder="e.g., Client visit, Site inspection"
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Submit Check In
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <h3>Check-In History</h3>
          {checkIns.length > 0 ? (
            <table className="table" style={{ marginTop: "16px" }}>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {checkIns.map((checkIn) => (
                  <tr key={checkIn.id}>
                    <td>
                      {new Date(
                        checkIn.timestamp || checkIn.createdAt
                      ).toLocaleString()}
                    </td>
                    <td>{checkIn.latitude}</td>
                    <td>{checkIn.longitude}</td>
                    <td>{checkIn.notes || "-"}</td>
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
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📍</div>
              <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>
                No Check-Ins Yet
              </h3>
              <p style={{ marginBottom: "24px" }}>
                Start tracking your location by checking in.
              </p>
              {isSales && (
                <button
                  onClick={() => setShowCheckInForm(true)}
                  className="btn btn-primary"
                >
                  Check In
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
