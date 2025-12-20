"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { bookingTokensAPI, hoardingsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

export default function HoardingTokenPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const hoardingId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hoarding, setHoarding] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  useEffect(() => {
    if (!hoardingId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const resp = await hoardingsAPI.getById(hoardingId);
        if (!cancelled) setHoarding(resp?.data || null);
      } catch (e) {
        if (!cancelled) showError("Failed to load hoarding");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [hoardingId]);

  const submit = async () => {
    if (!hoardingId) return;
    if (!dateFrom || !dateTo) {
      showError("Select date range");
      return;
    }

    try {
      setSubmitting(true);
      const resp = await bookingTokensAPI.create({
        hoardingId,
        dateFrom,
        dateTo,
      });
      if (resp?.success) {
        const pos = Number(resp?.data?.queuePosition || 0) || 1;
        setQueuePosition(pos);
        showSuccess(`Token created. You are #${pos} in queue.`);

        // Return to list so the salesperson can continue.
        setTimeout(() => {
          router.push("/hoardings");
        }, 300);
      } else {
        showError(resp?.message || "Failed to create token");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to create token");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute component="hoardings">
      <div>
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <Link href={`/hoardings/${hoardingId}`} className="btn btn-secondary">
            Back
          </Link>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: "12px" }}>Book (Token)</h2>

          {loading ? (
            <div>Loading...</div>
          ) : !hoarding ? (
            <div>Hoarding not found</div>
          ) : (
            <div
              style={{ marginBottom: "12px", color: "var(--text-secondary)" }}
            >
              <div>
                <strong>{hoarding.code || hoardingId}</strong>
              </div>
              <div>
                {(hoarding.city || "").trim()}
                {hoarding.area ? `, ${hoarding.area}` : ""}
                {hoarding.landmark ? `, ${hoarding.landmark}` : ""}
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: "12px" }}>From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: "12px" }}>To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "Booking..." : "Book (Token)"}
            </button>
          </div>

          {queuePosition !== null && (
            <div style={{ marginTop: "12px" }}>
              Queue position: <strong>#{queuePosition}</strong>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
