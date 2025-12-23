"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { bookingTokensAPI } from "@/lib/api";
import { getRoleFromUser } from "@/lib/rbac";
import { useUser } from "@/components/AppLayout";
import { showError, showErrorNoTitle, showSuccess } from "@/lib/toast";

export default function BookingTokenDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userFromContext = useUser();

  const [user, setUser] = useState<any>(null);

  const tokenId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<any>(null);

  useEffect(() => {
    if (userFromContext) {
      setUser(userFromContext);
      return;
    }
    const localUser = localStorage.getItem("user");
    if (!localUser) return;
    try {
      setUser(JSON.parse(localUser));
    } catch {
      setUser(null);
    }
  }, [userFromContext]);

  const userRole = useMemo(() => getRoleFromUser(user), [user]);
  const roleLower = String(userRole || "").toLowerCase();

  const canConfirm = useMemo(() => {
    return (
      roleLower === "owner" || roleLower === "manager" || roleLower === "admin"
    );
  }, [roleLower]);

  const canCancel = useMemo(() => {
    return (
      roleLower === "owner" || roleLower === "manager" || roleLower === "admin"
    );
  }, [roleLower]);

  const fetchToken = async () => {
    if (!tokenId) return;
    try {
      setLoading(true);
      const resp = await bookingTokensAPI.getById(tokenId);
      if (resp?.success) {
        setToken(resp?.data || null);
      } else {
        setToken(null);
        showError(resp?.message || "Failed to load token");
      }
    } catch (e: any) {
      setToken(null);
      showError(e?.response?.data?.message || "Failed to load token");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenId]);

  const statusLabel = (raw?: string) => {
    const s = String(raw || "").toLowerCase();
    if (s === "active") return "Active";
    if (s === "confirmed") return "Confirmed";
    if (s === "expired") return "Expired";
    if (s === "cancelled") return "Cancelled";
    return raw || "—";
  };

  const tokenStatusLower = String(token?.status || "").toLowerCase();
  const isActiveToken = tokenStatusLower === "active";
  const hoardingStatusLower = String(token?.hoarding?.status || "")
    .toLowerCase()
    .trim();
  const actionsDisabledByHoardingStatus =
    hoardingStatusLower === "under_process";

  const handleConfirm = async () => {
    if (!tokenId) return;
    if (!confirm("Confirm this token?")) return;

    // Pre-check (best-effort). Backend still enforces atomicity.
    if (hoardingStatusLower === "under_process") {
      showError("This hoarding is already Under Process");
      return;
    }

    try {
      setSubmitting(true);
      const resp = await bookingTokensAPI.confirm(tokenId);
      if (resp?.success) {
        showSuccess("Token confirmed");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to confirm");
      }
    } catch (e: any) {
      const msg = String(e?.response?.data?.message || "Failed to confirm");
      const lower = msg.toLowerCase();
      if (lower.includes("already") && lower.includes("under process")) {
        if (roleLower === "manager") {
          showErrorNoTitle(
            "By the time you confirm the token, it was already confirmed by other"
          );
          await fetchToken();
          return;
        }
        if (roleLower === "owner") {
          if (lower.includes("manager")) {
            showErrorNoTitle(
              "By the time you confirm the token, it was already confirmed by the manager"
            );
            await fetchToken();
            return;
          }
          showErrorNoTitle(
            "By the time you confirm the token, it was already confirmed by other"
          );
          await fetchToken();
          return;
        }
      }
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!tokenId) return;
    if (!confirm("Cancel this token?")) return;

    try {
      setSubmitting(true);
      const resp = await bookingTokensAPI.cancel(tokenId);
      if (resp?.success) {
        showSuccess("Token cancelled");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to cancel");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to cancel");
    } finally {
      setSubmitting(false);
    }
  };

  const hoardingId = String(token?.hoardingId || token?.hoarding?.id || "");

  return (
    <ProtectedRoute component="bookings">
      <div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <button className="btn btn-secondary" onClick={() => router.back()}>
            ← Back
          </button>
          <Link href="/notifications" className="btn btn-secondary">
            Notifications
          </Link>
          {hoardingId && (
            <Link
              href={`/hoardings/${hoardingId}?from=notification`}
              className="btn btn-secondary"
            >
              Open Hoarding
            </Link>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Token Details</h2>

          {loading ? (
            <div>Loading...</div>
          ) : !token ? (
            <div>Token not found</div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <div>
                  <strong>Status:</strong> {statusLabel(token.status)}
                </div>
                <div>
                  <strong>Hoarding Status:</strong>{" "}
                  {String(token?.hoarding?.status || "").replace(/_/g, " ") ||
                    "—"}
                </div>
                {typeof token.queuePosition === "number" && (
                  <div>
                    <strong>Queue:</strong> #{token.queuePosition}
                  </div>
                )}
                {token.expiresAt && (
                  <div>
                    <strong>Expires:</strong>{" "}
                    {new Date(token.expiresAt).toLocaleString()}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 16,
                }}
              >
                <div>
                  <strong>Hoarding:</strong>{" "}
                  {token.hoarding?.code || token.hoardingId}
                </div>
                <div>
                  <strong>Sales User:</strong>{" "}
                  {token.salesUser?.name || token.salesUserId}
                </div>
                <div>
                  <strong>From:</strong>{" "}
                  {token.dateFrom
                    ? new Date(token.dateFrom).toLocaleDateString()
                    : "—"}
                </div>
                <div>
                  <strong>To:</strong>{" "}
                  {token.dateTo
                    ? new Date(token.dateTo).toLocaleDateString()
                    : "—"}
                </div>
                <div>
                  <strong>Duration:</strong>{" "}
                  {token.durationMonths
                    ? `${token.durationMonths} months`
                    : "—"}
                </div>
                <div>
                  <strong>Notes:</strong> {token.notes || "—"}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 8 }}>Client</h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 16,
                  }}
                >
                  <div>
                    <strong>Name:</strong> {token.client?.name || "—"}
                  </div>
                  <div>
                    <strong>Phone:</strong> {token.client?.phone || "—"}
                  </div>
                  <div>
                    <strong>Email:</strong> {token.client?.email || "—"}
                  </div>
                  <div>
                    <strong>Company:</strong> {token.client?.companyName || "—"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  marginTop: 20,
                  flexWrap: "wrap",
                }}
              >
                {canCancel &&
                  isActiveToken &&
                  !actionsDisabledByHoardingStatus && (
                    <button
                      className="btn btn-secondary"
                      onClick={handleCancel}
                      disabled={submitting}
                    >
                      Cancel Token
                    </button>
                  )}
                {canConfirm &&
                  isActiveToken &&
                  !actionsDisabledByHoardingStatus && (
                    <button
                      className="btn btn-primary"
                      onClick={handleConfirm}
                      disabled={submitting}
                    >
                      Confirm Token
                    </button>
                  )}
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
