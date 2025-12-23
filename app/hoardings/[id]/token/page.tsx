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
  const [durationMonths, setDurationMonths] = useState<number | undefined>(
    undefined
  );
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  const isUnderProcess =
    String(hoarding?.status || "")
      .toLowerCase()
      .trim() === "under_process";

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
    if (isUnderProcess) {
      showError("This hoarding is Under Process and cannot be tokenized");
      return;
    }
    if (!dateFrom) {
      showError("Select start date");
      return;
    }

    // require duration or dateTo
    if (!durationMonths && !dateTo) {
      showError("Select duration or end date");
      return;
    }

    if (!clientPhone || clientPhone.trim().length < 6) {
      showError("Client phone is required");
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        hoardingId,
        dateFrom,
        notes: undefined,
        client: {
          name: clientName || "Unknown",
          phone: clientPhone,
          email: clientEmail || undefined,
          companyName: clientCompany || undefined,
        },
      };
      if (durationMonths) payload.durationMonths = durationMonths;
      if (!durationMonths && dateTo) payload.dateTo = dateTo;

      const resp = await bookingTokensAPI.create(payload);
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

          <div>
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
                <label style={{ fontSize: "12px" }}>Duration (months)</label>
                <select
                  value={durationMonths ?? ""}
                  onChange={(e) =>
                    setDurationMonths(
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                >
                  <option value="">Select</option>
                  <option value="3">3</option>
                  <option value="6">6</option>
                  <option value="9">9</option>
                  <option value="12">12</option>
                </select>
              </div>

              <div style={{ width: "100%" }} />

              <div
                className="form-group"
                style={{ margin: 0, flex: "1 1 300px" }}
              >
                <label style={{ fontSize: "12px" }}>Client name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              <div
                className="form-group"
                style={{ margin: 0, flex: "1 1 200px" }}
              >
                <label style={{ fontSize: "12px" }}>Client phone</label>
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </div>
              <div
                className="form-group"
                style={{ margin: 0, flex: "1 1 300px" }}
              >
                <label style={{ fontSize: "12px" }}>Client email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>
              <div
                className="form-group"
                style={{ margin: 0, flex: "1 1 300px" }}
              >
                <label style={{ fontSize: "12px" }}>Company</label>
                <input
                  type="text"
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 24,
              }}
            >
              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={submitting || isUnderProcess}
                style={{ minWidth: 140 }}
              >
                {submitting ? "Booking..." : "Book (Token)"}
              </button>
            </div>
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
