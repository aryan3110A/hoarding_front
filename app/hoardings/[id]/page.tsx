"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/components/AppLayout";
import { hoardingsAPI, propertyRentAPI } from "@/lib/api";
import { canUpdate, canDelete, getRoleFromUser, canViewRent } from "@/lib/rbac";
import ProtectedRoute from "@/components/ProtectedRoute";
import { showError, showSuccess } from "@/lib/toast";

export default function HoardingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userFromContext = useUser();
  const [user, setUser] = useState<any>(null);
  const hoardingId = String(params?.id || "");

  const [hoarding, setHoarding] = useState<any>(null);
  const [landlordRent, setLandlordRent] = useState<any>(null);
  const [landlordInfo, setLandlordInfo] = useState<{
    name: string;
    phone: string;
    email: string;
  }>({ name: "", phone: "", email: "" });
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

  const extractLandlordInfo = (record: any) => {
    const history =
      record?.rateHistory && typeof record.rateHistory === "object"
        ? record.rateHistory
        : {};

    const fromHistory =
      (history as any)?.landlordName || (history as any)?.landlord || "";
    const ownership = String(record?.ownership || "");
    const ownershipMatch = ownership.match(
      /^(gov|govt|government)\s*-\s*(.+)$/i,
    );
    const landlordName =
      String(fromHistory || "").trim() ||
      (ownershipMatch && ownershipMatch[2] ? ownershipMatch[2].trim() : "");

    const phone = String(
      (history as any)?.landlordPhone ||
        (history as any)?.phone ||
        (history as any)?.ownerPhone ||
        "",
    ).trim();
    const email = String(
      (history as any)?.landlordEmail ||
        (history as any)?.email ||
        (history as any)?.ownerEmail ||
        "",
    ).trim();

    return { name: landlordName, phone, email };
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch hoarding details
      const hoardingResponse = await hoardingsAPI.getById(hoardingId);
      if (hoardingResponse.success) {
        const detail = hoardingResponse.data;
        setHoarding(detail);
        const landlord = extractLandlordInfo(detail);
        setLandlordInfo(landlord);

        if (landlord.name) {
          try {
            const rentResponse = await propertyRentAPI.getByLandlord(
              landlord.name,
            );
            if (rentResponse.success && rentResponse.data) {
              setLandlordRent(rentResponse.data);
            } else {
              setLandlordRent(null);
            }
          } catch (error: any) {
            setLandlordRent(null);
            if (error.response?.status !== 404) {
              console.error("Error fetching landlord rent:", error);
            }
          }
        } else {
          setLandlordRent(null);
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
          (error.response?.data?.message || "Unknown error"),
      );
    }
  };

  // Safely extract role from user object
  const userRole = getRoleFromUser(user);
  const canEdit = canUpdate(userRole, "hoardings");
  const canDeleteHoarding = canDelete(userRole, "hoardings");
  const canViewRentDetails = canViewRent(userRole);

  const isOwner = useMemo(() => {
    return String(userRole || "").toLowerCase() === "owner";
  }, [userRole]);

  const isManager = useMemo(() => {
    return String(userRole || "").toLowerCase() === "manager";
  }, [userRole]);

  const openedFromNotification = useMemo(() => {
    return (
      String(searchParams?.get("from") || "").toLowerCase() === "notification"
    );
  }, [searchParams]);

  const canMarkUnderProcess = useMemo(() => {
    const r = String(userRole || "").toLowerCase();
    return r === "owner" || r === "manager" || r === "admin";
  }, [userRole]);

  const statusLabel = (raw?: string) => {
    const s = String(raw || "").toLowerCase();
    if (s === "on_rent") return "On Rent";
    if (s === "under_process") return "Under Process";
    if (s === "tokenized") return "Tokenized";
    return raw || "—";
  };

  const handleMarkUnderProcess = async () => {
    if (!confirm("Mark this hoarding as Under Process?")) return;
    try {
      const resp = await hoardingsAPI.markUnderProcess(hoardingId);
      if (resp.success) {
        showSuccess("Status updated to Under Process");
        await fetchData();
      } else {
        showError(resp.message || "Failed to update status");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to update status");
    }
  };

  return (
    <ProtectedRoute component="hoardings">
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
          {!loading && hoarding?.code && (
            <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
              <strong>{hoarding.code}</strong>
            </p>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
            <p>Loading hoarding details...</p>
          </div>
        ) : !hoarding ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p>Hoarding not found</p>
            <Link href="/hoardings" className="btn btn-secondary">
              Back to Hoardings
            </Link>
          </div>
        ) : (
          <>
            {(() => {
              const hoardingStatus = String(hoarding.status || "")
                .toLowerCase()
                .trim();
              const isUnderProcess = hoardingStatus === "under_process";
              const isLive = hoardingStatus === "live";
              const isBooked = hoardingStatus === "booked";
              const isBlocked = hoardingStatus === "blocked";
              const isTokenized = hoardingStatus === "tokenized";
              const hideOwnerBookButton =
                isOwner && (isUnderProcess || isTokenized || isBlocked);
              const hideManagerBookButton = isManager && openedFromNotification;
              const hideBlockedButton = isBlocked;

              const tokenizeDisabled =
                isUnderProcess || isLive || isBooked || isBlocked;
              const tokenizeLabel = isBooked ? "Booked" : "Block Hoarding";
              return (
                <div
                  style={{ display: "flex", gap: "12px", marginBottom: "16px" }}
                >
                  {hideBlockedButton ||
                  hideOwnerBookButton ||
                  hideManagerBookButton ? null : isUnderProcess ? (
                    <button className="btn btn-primary" disabled>
                      {tokenizeLabel}
                    </button>
                  ) : tokenizeDisabled ? (
                    <button className="btn btn-primary" disabled>
                      {tokenizeLabel}
                    </button>
                  ) : (
                    <Link
                      href={`/hoardings/${hoardingId}/token`}
                      className="btn btn-primary"
                    >
                      {tokenizeLabel}
                    </Link>
                  )}
                  {canMarkUnderProcess &&
                    String(hoarding.status || "").toLowerCase() ===
                      "tokenized" && (
                      <button
                        className="btn btn-warning"
                        onClick={handleMarkUnderProcess}
                      >
                        Mark Under Process
                      </button>
                    )}
                </div>
              );
            })()}

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
                        hoarding.heightCm / 30.48,
                      )}ft`
                    : "N/A"}
                </div>
                <div>
                  <strong>Type:</strong> {hoarding.type || "N/A"}
                </div>
                <div>
                  <strong>Category:</strong> {hoarding?.category?.name || "N/A"}
                </div>
                <div>
                  <strong>Ownership:</strong> {hoarding.ownership || "N/A"}
                </div>
                <div>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`badge ${
                      String(hoarding.status || "").toLowerCase() ===
                      "available"
                        ? "badge-success"
                        : ["on_rent", "booked"].includes(
                              String(hoarding.status || "").toLowerCase(),
                            )
                          ? "badge-danger"
                          : "badge-warning"
                    }`}
                  >
                    {statusLabel(hoarding.status)}
                  </span>
                </div>
                <div>
                  <strong>Standard Rate:</strong>{" "}
                  {(hoarding.standardRate ?? hoarding.baseRate)
                    ? `₹${Number(hoarding.standardRate ?? hoarding.baseRate).toLocaleString()}`
                    : "N/A"}
                </div>
                <div>
                  <strong>Minimum Rate:</strong>{" "}
                  {hoarding.minimumRate != null
                    ? `₹${Number(hoarding.minimumRate).toLocaleString()}`
                    : "N/A"}
                </div>
                {hoarding.lat && hoarding.lng && (
                  <div>
                    <strong>Location:</strong> {hoarding.lat}, {hoarding.lng}
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: "24px" }}>
              <h3>Landlord Information</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "16px",
                }}
              >
                <div>
                  <strong>Landlord Name:</strong> {landlordInfo.name || "N/A"}
                </div>
                <div>
                  <strong>Phone:</strong> {landlordInfo.phone || "N/A"}
                </div>
                <div>
                  <strong>Email:</strong> {landlordInfo.email || "N/A"}
                </div>
              </div>
            </div>

            {landlordRent && (
              <div className="card" style={{ marginBottom: "24px" }}>
                <h3>Landlord Rent Reference</h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "16px",
                  }}
                >
                  <div>
                    <strong>Rent Amount:</strong> ₹
                    {Number(landlordRent.rentAmount).toLocaleString()}
                  </div>
                  <div>
                    <strong>Payment Frequency:</strong>{" "}
                    {landlordRent.paymentFrequency || "N/A"}
                  </div>
                  <div>
                    <strong>Rent Start Date:</strong>{" "}
                    {landlordRent.rentStartDate
                      ? new Date(
                          landlordRent.rentStartDate,
                        ).toLocaleDateString()
                      : "N/A"}
                  </div>
                  {landlordRent.nextDueDate && (
                    <div>
                      <strong>Next Due Date:</strong>{" "}
                      {new Date(landlordRent.nextDueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              {canViewRentDetails &&
                !(openedFromNotification && (isOwner || isManager)) &&
                (landlordInfo.name ? (
                  <Link
                    href={`/landlords/${encodeURIComponent(landlordInfo.name)}/rent`}
                    className="btn btn-primary"
                    style={{
                      backgroundColor: "#f59e0b",
                      borderColor: "#f59e0b",
                    }}
                  >
                    Edit Rent Details
                  </Link>
                ) : (
                  <button className="btn btn-secondary" disabled>
                    Landlord Not Mapped
                  </button>
                ))}
              {canEdit &&
                !(
                  isOwner &&
                  !openedFromNotification &&
                  ["under_process", "tokenized"].includes(
                    String(hoarding.status || "")
                      .toLowerCase()
                      .trim(),
                  )
                ) && (
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
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
