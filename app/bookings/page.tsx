"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useUser } from "@/components/AppLayout";
import { canCreate, canUpdate, canEditOwn } from "@/lib/rbac";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Bookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [hoardings, setHoardings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUser();
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenForm, setTokenForm] = useState({
    hoardingId: "",
    startDate: "",
    endDate: "",
  });
  const router = useRouter();

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

      // Fetch bookings and hoardings
      const [bookingsRes, hoardingsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/bookings`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        axios.get(`${API_URL}/api/hoardings`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      // Extract data from responses
      const bookingsData =
        bookingsRes.status === "fulfilled"
          ? bookingsRes.value.data?.data || bookingsRes.value.data?.data || []
          : [];
      const hoardingsData =
        hoardingsRes.status === "fulfilled"
          ? hoardingsRes.value.data?.data?.hoardings ||
            hoardingsRes.value.data?.hoardings ||
            hoardingsRes.value.data?.data?.hoardings ||
            []
          : [];

      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setHoardings(Array.isArray(hoardingsData) ? hoardingsData : []);
      setLoading(false); // Set loading to false immediately after setting data
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setBookings([]);
      setHoardings([]);
      setLoading(false); // Set loading to false on error too
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const authToken = localStorage.getItem("token");
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

      const clientName = prompt("Enter Client Name:");
      const clientContact = prompt("Enter Client Contact:");
      const price = prompt("Enter Total Price:");

      if (!clientName || !clientContact) {
        alert("Client name and contact are required");
        return;
      }

      await axios.post(
        `${API_URL}/api/bookings`,
        {
          hoardingId: tokenForm.hoardingId,
          startDate: tokenForm.startDate,
          endDate: tokenForm.endDate,
          clientName,
          clientContact,
          price: price ? parseFloat(price) : null,
          status: "confirmed",
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      setShowTokenForm(false);
      setTokenForm({ hoardingId: "", startDate: "", endDate: "" });
      fetchData();
      alert("Booking created successfully!");
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to create booking"
      );
    }
  };

  const getHoardingName = (id: string) => {
    const hoarding = hoardings.find((h) => h.id === id);
    return hoarding ? `${hoarding.city}, ${hoarding.area}` : id;
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const userRole = user?.role || "";
  const isSales = userRole?.toLowerCase() === "sales";
  const canCreateBooking = canCreate(userRole, "bookings");

  // Don't show loading spinner - show content immediately with empty state if needed

  return (
    <ProtectedRoute component="bookings">
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h1>Bookings</h1>
          {canCreateBooking && (
            <button
              onClick={() => setShowTokenForm(!showTokenForm)}
              className="btn btn-primary"
            >
              {showTokenForm ? "Cancel" : "Create New Booking"}
            </button>
          )}
        </div>

        {showTokenForm && canCreateBooking && (
          <div className="card">
            <h3>Create New Booking</h3>
            <form onSubmit={handleCreateBooking}>
              <div className="form-group">
                <label>Hoarding *</label>
                <select
                  value={tokenForm.hoardingId}
                  onChange={(e) =>
                    setTokenForm({ ...tokenForm, hoardingId: e.target.value })
                  }
                  required
                >
                  <option value="">Select Hoarding</option>
                  {hoardings
                    .filter((h) => h.status === "available")
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.city}, {h.area}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  value={tokenForm.startDate}
                  onChange={(e) =>
                    setTokenForm({ ...tokenForm, startDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  value={tokenForm.endDate}
                  onChange={(e) =>
                    setTokenForm({ ...tokenForm, endDate: e.target.value })
                  }
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Create Booking
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <h3>All Bookings</h3>
          {bookings.length > 0 ? (
            <div className="grid">
              {bookings.map((booking) => (
                <div key={booking.id} className="card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <h3>{getHoardingName(booking.hoardingId)}</h3>
                      <p className="text-secondary">
                        Client: {booking.clientName}
                      </p>
                      <p className="text-secondary">
                        Contact: {booking.clientContact}
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        booking.status === "confirmed"
                          ? "badge-success"
                          : "badge-warning"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <div style={{ marginTop: "16px" }}>
                    <p>
                      <strong>From:</strong>{" "}
                      {new Date(booking.startDate).toLocaleDateString()}
                    </p>
                    <p>
                      <strong>To:</strong>{" "}
                      {new Date(booking.endDate).toLocaleDateString()}
                    </p>
                    {booking.price && (
                      <p>
                        <strong>Price:</strong> ₹{booking.price}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="card"
              style={{ textAlign: "center", padding: "40px" }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
              <h3>No Bookings Found</h3>
              <p style={{ color: "var(--text-secondary)" }}>
                {loading
                  ? "Loading bookings..."
                  : "There are no bookings in the system yet."}
              </p>
              {canCreateBooking && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: "16px" }}
                  onClick={() => setShowTokenForm(true)}
                >
                  Create First Booking
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
