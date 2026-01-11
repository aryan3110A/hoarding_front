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
  const [durationMonths, setDurationMonths] = useState<
    string | number | undefined
  >(undefined);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  const hoardingStatus = String(hoarding?.status || "")
    .toLowerCase()
    .trim();
  const isUnderProcess = hoardingStatus === "under_process";
  const isLive = hoardingStatus === "live";
  const isBooked = hoardingStatus === "booked";

  useEffect(() => {
    if (!hoardingId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const resp = await hoardingsAPI.getById(hoardingId);
        const hoardingData = resp?.data || null;
        if (!cancelled) setHoarding(hoardingData);

        const s = String(hoardingData?.status || "")
          .toLowerCase()
          .trim();
        if (s === "booked") {
          showError("This hoarding is already booked and cannot be tokenized.");
          router.replace(`/hoardings/${hoardingId}`);
          return;
        }
        if (s === "live") {
          showError("This hoarding is Live and cannot be tokenized");
          router.replace(`/hoardings/${hoardingId}`);
          return;
        }
        if (s === "under_process") {
          showError("This hoarding is Under Process and cannot be tokenized");
          router.replace(`/hoardings/${hoardingId}`);
          return;
        }
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
    if (isBooked) {
      showError("This hoarding is already booked and cannot be tokenized.");
      return;
    }
    if (isLive) {
      showError("This hoarding is Live and cannot be tokenized");
      return;
    }
    if (isUnderProcess) {
      showError("This hoarding is Under Process and cannot be tokenized");
      return;
    }
    // Sales users should not supply start date; it will be set when fitter marks fitted.
    // We no longer ask sales or other users to provide `From`/`To` here.
    // Backend expects a dateFrom value; use today's date as a placeholder —
    // the contract startDate will be set when the fitter marks the hoarding fitted.

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
      const defaultDateFrom = new Date();
      const defaultDateFromStr = defaultDateFrom.toISOString().split("T")[0];

      const payload: any = {
        hoardingId,
        // always send today's date as placeholder; actual contract start is set on fitter completion
        dateFrom: dateFrom || defaultDateFromStr,
        notes: undefined,
        client: {
          name: clientName || "Unknown",
          phone: clientPhone,
          email: clientEmail || undefined,
          companyName: clientCompany || undefined,
        },
      };
      if (typeof durationMonths === "string" && durationMonths.endsWith("d")) {
        // day-based selection e.g. '8d' -> compute dateTo from effective dateFrom
        const days = parseInt(durationMonths.replace("d", ""), 10) || 0;
        const effectiveFrom = dateFrom || defaultDateFromStr;
        if (days > 0 && effectiveFrom) {
          const start = new Date(effectiveFrom);
          const dt = new Date(start);
          dt.setDate(start.getDate() + days);
          // API expects date string (YYYY-MM-DD)
          payload.dateTo = dt.toISOString().split("T")[0];
        }
      } else if (typeof durationMonths === "number") {
        payload.durationMonths = durationMonths;
      } else if (!durationMonths && dateTo) payload.dateTo = dateTo;

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
          <h2 style={{ marginBottom: "12px" }}>Block Hoarding</h2>

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
              {/* From input removed — start date is set when fitter marks fitted */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: "12px" }}>
                  Duration (months / days)
                </label>
                <select
                  value={durationMonths ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return setDurationMonths(undefined);
                    // support day-based option like '8d'
                    if (v.endsWith("d")) return setDurationMonths(v);
                    const n = Number(v);
                    setDurationMonths(isNaN(n) ? undefined : n);
                  }}
                >
                  <option value="">Select</option>
                  <option value="3">3</option>
                  <option value="6">6</option>
                  <option value="9">9</option>
                  <option value="12">12</option>
                  <option value="8d">8 days</option>
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
                disabled={submitting || isUnderProcess || isLive || isBooked}
                style={{ minWidth: 140 }}
              >
                {submitting ? "Blocking..." : "Block Hoarding"}
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
