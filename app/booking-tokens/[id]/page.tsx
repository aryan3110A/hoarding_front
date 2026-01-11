"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { bookingTokensAPI, hoardingsAPI, usersAPI } from "@/lib/api";
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

  const [designers, setDesigners] = useState<any[]>([]);
  const [loadingDesigners, setLoadingDesigners] = useState(false);
  const [selectedDesignerId, setSelectedDesignerId] = useState<string>("");

  const [fitters, setFitters] = useState<any[]>([]);
  const [loadingFitters, setLoadingFitters] = useState(false);
  const [selectedFitterId, setSelectedFitterId] = useState<string>("");

  const [installationStatusDraft, setInstallationStatusDraft] = useState<
    "pending" | "in_progress" | "fitted"
  >("pending");
  const [installationProofFiles, setInstallationProofFiles] = useState<File[]>(
    []
  );

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

  const canFinalize = useMemo(() => {
    return (
      roleLower === "owner" ||
      roleLower === "manager" ||
      roleLower === "sales" ||
      roleLower === "admin"
    );
  }, [roleLower]);

  const isDesigner = useMemo(() => roleLower === "designer", [roleLower]);
  const isFitter = useMemo(() => roleLower === "fitter", [roleLower]);

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

  // Live updates for design status
  useEffect(() => {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:3001";
    const accessToken =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const query = accessToken
      ? `?token=${encodeURIComponent(accessToken)}`
      : "";
    const url = `${apiBase}/api/events/design-status${query}`;
    const source = new EventSource(url as any);
    source.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data || "{}") as {
          tokenId?: string;
          designStatus?: string;
        };
        if (!payload?.tokenId) return;
        if (String(payload.tokenId) !== String(tokenId)) return;
        if (!payload.designStatus) return;
        setToken((prev: any) =>
          prev ? { ...prev, designStatus: payload.designStatus } : prev
        );
      } catch (_) {}
    };
    source.onerror = () => {
      // ignore; browser reconnects
    };
    return () => {
      try {
        source.close();
      } catch (_) {}
    };
  }, [tokenId]);

  // Live updates for installation (fitter) status
  useEffect(() => {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:3001";
    const accessToken =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const query = accessToken
      ? `?token=${encodeURIComponent(accessToken)}`
      : "";
    const url = `${apiBase}/api/events/fitter-status${query}`;
    const source = new EventSource(url as any);
    source.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data || "{}") as {
          tokenId?: string;
          fitterStatus?: string;
          fitterId?: string;
        };
        if (!payload?.tokenId) return;
        if (String(payload.tokenId) !== String(tokenId)) return;
        setToken((prev: any) =>
          prev
            ? {
                ...prev,
                fitterStatus: payload.fitterStatus ?? prev.fitterStatus,
                fitterId: payload.fitterId ?? prev.fitterId,
              }
            : prev
        );
      } catch (_) {}
    };
    source.onerror = () => {
      // ignore; browser reconnects
    };
    return () => {
      try {
        source.close();
      } catch (_) {}
    };
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

  const tokenDesignerId = String(
    token?.designerId || token?.designer?.id || ""
  );
  const tokenFitterId = String(token?.fitterId || token?.fitter?.id || "");
  const canUpdateDesignStatus =
    isDesigner &&
    tokenDesignerId &&
    String(tokenDesignerId) === String(user?.id || "");
  const canUpdateFitterStatus =
    isFitter &&
    tokenFitterId &&
    String(tokenFitterId) === String(user?.id || "");

  const designStatusLabel = (raw?: string) => {
    const normalized = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (normalized === "pending") return "Pending";
    if (normalized === "in_progress" || normalized === "inprogress")
      return "In Progress";
    if (normalized === "completed") return "Completed";
    const upper = String(raw || "")
      .trim()
      .toUpperCase();
    if (upper === "PENDING") return "Pending";
    if (upper === "IN_PROGRESS") return "In Progress";
    if (upper === "COMPLETED") return "Completed";
    return "Pending";
  };

  const normalizedDesignStatus = useMemo(() => {
    const raw = String(token?.designStatus || "PENDING");
    const upper = raw.toUpperCase();
    if (upper === "PENDING") return "pending";
    if (upper === "IN_PROGRESS") return "in_progress";
    if (upper === "COMPLETED") return "completed";
    return String(raw || "pending").toLowerCase();
  }, [token?.designStatus]);

  const isDesignCompleted = useMemo(() => {
    return (
      token?.status === "CONFIRMED" && normalizedDesignStatus === "completed"
    );
  }, [token?.status, normalizedDesignStatus]);

  const fitterStatusLabel = (raw?: string) => {
    const normalized = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (normalized === "pending") return "Pending Installation";
    if (normalized === "in_progress" || normalized === "inprogress")
      return "In Progress";
    if (normalized === "completed" || normalized === "fitted") return "Fitted";
    const upper = String(raw || "")
      .trim()
      .toUpperCase();
    if (upper === "PENDING") return "Pending Installation";
    if (upper === "IN_PROGRESS") return "In Progress";
    if (upper === "COMPLETED") return "Fitted";
    return "Pending Installation";
  };

  const normalizedFitterStatus = useMemo(() => {
    const raw = String(token?.fitterStatus || "PENDING");
    const upper = raw.toUpperCase();
    if (upper === "PENDING") return "pending";
    if (upper === "IN_PROGRESS") return "in_progress";
    if (upper === "COMPLETED") return "fitted";
    return String(raw || "pending").toLowerCase();
  }, [token?.fitterStatus]);

  // Keep installation draft aligned with server status
  useEffect(() => {
    const next =
      normalizedFitterStatus === "in_progress"
        ? "in_progress"
        : normalizedFitterStatus === "fitted"
        ? "fitted"
        : "pending";
    setInstallationStatusDraft(next);
    if (next !== "fitted") {
      setInstallationProofFiles([]);
    }
  }, [normalizedFitterStatus]);

  // Load designers for assignment at confirmation time
  useEffect(() => {
    const shouldLoad =
      canConfirm && isActiveToken && !actionsDisabledByHoardingStatus;
    if (!shouldLoad) return;
    if (!user) return;

    const run = async () => {
      try {
        setLoadingDesigners(true);
        const resp = await usersAPI.getAll();
        const rows = Array.isArray(resp?.data)
          ? resp.data
          : resp?.data?.users || resp?.data || [];
        const list = (rows || []).filter((u: any) =>
          String(u?.role?.name || u?.role || "")
            .toLowerCase()
            .includes("designer")
        );
        setDesigners(list);
        if (list.length === 1) {
          setSelectedDesignerId(String(list[0]?.id || ""));
        } else if (
          list.length > 0 &&
          (roleLower === "owner" || roleLower === "manager")
        ) {
          // Match current UX expectation: default-select a designer for Owner/Manager.
          // Keep user choice if they've already selected one.
          setSelectedDesignerId((prev) => prev || String(list[0]?.id || ""));
        }
      } catch (e) {
        setDesigners([]);
      } finally {
        setLoadingDesigners(false);
      }
    };

    run();
  }, [
    canConfirm,
    isActiveToken,
    actionsDisabledByHoardingStatus,
    user,
    roleLower,
  ]);

  // Load fitters for assignment after design is completed
  useEffect(() => {
    const shouldLoad = canConfirm && !!user && isDesignCompleted;
    if (!shouldLoad) return;

    const run = async () => {
      try {
        setLoadingFitters(true);
        const resp = await bookingTokensAPI.fitters();
        const rows = Array.isArray(resp?.data) ? resp.data : resp?.data || [];
        setFitters(rows);
        if (rows.length === 1) {
          setSelectedFitterId(String(rows[0]?.id || ""));
        }
      } catch (e) {
        setFitters([]);
      } finally {
        setLoadingFitters(false);
      }
    };

    run();
  }, [canConfirm, user, isDesignCompleted]);

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
      if (designers.length > 1 && !selectedDesignerId) {
        showError("Please select a designer to assign");
        return;
      }
      const payload = selectedDesignerId
        ? { designerId: selectedDesignerId }
        : undefined;
      const resp = await bookingTokensAPI.confirm(tokenId, payload);
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

  const handleDesignStatusUpdate = async (
    next: "pending" | "in_progress" | "completed"
  ) => {
    if (!tokenId) return;
    try {
      setSubmitting(true);
      const resp = await bookingTokensAPI.updateDesignStatus(tokenId, next);
      if (resp?.success) {
        showSuccess("Design status updated");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to update design status");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to update design status");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignFitter = async () => {
    if (!tokenId) return;
    if (!confirm("Assign fitter for installation?")) return;

    try {
      setSubmitting(true);
      if (fitters.length > 1 && !selectedFitterId) {
        showError("Please select a fitter to assign");
        return;
      }
      const payload = selectedFitterId
        ? { fitterId: selectedFitterId }
        : undefined;
      const resp = await bookingTokensAPI.assignFitter(tokenId, payload);
      if (resp?.success) {
        showSuccess("Fitter assigned");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to assign fitter");
      }
    } catch (e: any) {
      const msg = String(
        e?.response?.data?.message || "Failed to assign fitter"
      );
      const status = Number(e?.response?.status || 0);
      const isAlreadyAssigned =
        status === 409 ||
        (msg.toLowerCase().includes("already") &&
          msg.toLowerCase().includes("assigned"));
      if (isAlreadyAssigned) {
        showError("This hoarding has already been assigned by another user.");
        await fetchToken();
        return;
      }
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFitterStatusUpdate = async (next: "pending" | "in_progress") => {
    if (!tokenId) return;
    try {
      setSubmitting(true);
      const resp = await bookingTokensAPI.updateFitterStatus(tokenId, next);
      if (resp?.success) {
        showSuccess("Installation status updated");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to update installation status");
      }
    } catch (e: any) {
      showError(
        e?.response?.data?.message || "Failed to update installation status"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstallationSubmit = async () => {
    if (!tokenId) return;
    if (!canUpdateFitterStatus) {
      showError("Only the assigned fitter can update installation status.");
      return;
    }

    // Enforce strict forward-only transitions
    if (normalizedFitterStatus === "fitted") {
      showErrorNoTitle("Already fitted");
      return;
    }

    if (installationStatusDraft === "pending") {
      showErrorNoTitle("Cannot move back to pending");
      return;
    }

    if (installationStatusDraft === "in_progress") {
      if (normalizedFitterStatus !== "pending") {
        showErrorNoTitle("Cannot mark in progress");
        return;
      }
      await handleFitterStatusUpdate("in_progress");
      return;
    }

    // fitted
    if (installationStatusDraft === "fitted") {
      if (normalizedFitterStatus !== "in_progress") {
        showErrorNoTitle("Must be in progress before fitting");
        return;
      }
      if (!installationProofFiles.length) {
        showError("Please upload at least 1 proof image.");
        return;
      }
      try {
        setSubmitting(true);
        const resp = await bookingTokensAPI.completeInstallation(
          tokenId,
          installationProofFiles
        );
        if (resp?.success) {
          showSuccess("Installation marked as fitted");
          await fetchToken();
        } else {
          showError(resp?.message || "Failed to complete installation");
        }
      } catch (e: any) {
        showError(
          e?.response?.data?.message || "Failed to complete installation"
        );
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleMarkBooked = async () => {
    const hoardingId = String(token?.hoardingId || token?.hoarding?.id || "");
    if (!hoardingId) return;
    if (!canFinalize) {
      showError("Not authorized to finalize status");
      return;
    }
    if (normalizedFitterStatus !== "fitted") {
      showError("Installation must be fitted before finalizing");
      return;
    }
    const currentHoardingStatus = String(
      token?.hoarding?.status || ""
    ).toLowerCase();
    if (currentHoardingStatus === "booked") {
      showError("Already booked");
      return;
    }
    if (currentHoardingStatus !== "live") {
      showError("Hoarding must be Live to mark as booked");
      return;
    }
    if (!confirm("Mark hoarding as BOOKED?")) return;

    try {
      setSubmitting(true);
      const resp = await hoardingsAPI.finalizeStatus(hoardingId, "booked");
      if (resp?.success) {
        showSuccess("Hoarding marked BOOKED");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to finalize status");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to finalize status");
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
    <ProtectedRoute component="bookingTokens">
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
                {token.status === "CONFIRMED" && (
                  <div>
                    <strong>Design Status:</strong>{" "}
                    {designStatusLabel(normalizedDesignStatus)}
                  </div>
                )}
                {token.status === "CONFIRMED" && tokenFitterId && (
                  <div>
                    <strong>Installation Status:</strong>{" "}
                    {fitterStatusLabel(normalizedFitterStatus)}
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
                {tokenDesignerId && (
                  <div>
                    <strong>Designer:</strong>{" "}
                    {token.designer?.name || tokenDesignerId}
                  </div>
                )}
                {tokenFitterId && (
                  <div>
                    <strong>Fitter:</strong>{" "}
                    {token.fitter?.name || tokenFitterId}
                  </div>
                )}
                {/* Hide From/To — these are determined when fitter completes installation */}
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
                <h3 style={{ marginBottom: 8 }}>Hoarding Details</h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 16,
                  }}
                >
                  <div>
                    <strong>Location:</strong> {token.hoarding?.city || ""}
                    {token.hoarding?.area ? `, ${token.hoarding.area}` : ""}
                  </div>
                  <div>
                    <strong>Landmark:</strong> {token.hoarding?.landmark || "—"}
                  </div>
                  <div>
                    <strong>Road:</strong> {token.hoarding?.roadName || "—"}
                  </div>
                  <div>
                    <strong>Side:</strong> {token.hoarding?.side || "—"}
                  </div>
                  <div>
                    <strong>Size:</strong>{" "}
                    {token.hoarding?.widthCm && token.hoarding?.heightCm
                      ? `${token.hoarding.widthCm}cm x ${token.hoarding.heightCm}cm`
                      : "—"}
                  </div>
                  <div>
                    <strong>Type:</strong> {token.hoarding?.type || "—"}
                  </div>
                </div>
              </div>

              {token.status === "CONFIRMED" && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ marginBottom: 8 }}>Design Progress</h3>
                  {canUpdateDesignStatus ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        className="btn btn-secondary"
                        disabled={submitting}
                        aria-disabled={
                          submitting || normalizedDesignStatus !== "pending"
                        }
                        style={
                          submitting || normalizedDesignStatus !== "pending"
                            ? { opacity: 0.6, cursor: "not-allowed" }
                            : undefined
                        }
                        onClick={() => {
                          if (submitting) return;
                          if (normalizedDesignStatus === "in_progress") {
                            showErrorNoTitle("Already in progress");
                            return;
                          }
                          if (normalizedDesignStatus === "completed") {
                            showErrorNoTitle("Already completed");
                            return;
                          }
                          if (normalizedDesignStatus !== "pending") {
                            showErrorNoTitle("Cannot mark in progress");
                            return;
                          }
                          handleDesignStatusUpdate("in_progress");
                        }}
                      >
                        Mark In Progress
                      </button>
                      <button
                        className="btn btn-primary"
                        disabled={submitting}
                        aria-disabled={
                          submitting || normalizedDesignStatus !== "in_progress"
                        }
                        style={
                          submitting || normalizedDesignStatus !== "in_progress"
                            ? { opacity: 0.6, cursor: "not-allowed" }
                            : undefined
                        }
                        onClick={() => {
                          if (submitting) return;
                          if (normalizedDesignStatus === "completed") {
                            showErrorNoTitle("Already completed");
                            return;
                          }
                          if (normalizedDesignStatus === "pending") {
                            showErrorNoTitle("Already pending");
                            return;
                          }
                          if (normalizedDesignStatus !== "in_progress") {
                            showErrorNoTitle("Cannot mark completed");
                            return;
                          }
                          handleDesignStatusUpdate("completed");
                        }}
                      >
                        Mark Completed
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-secondary)" }}>
                      Only the assigned designer can update design status.
                    </div>
                  )}
                </div>
              )}

              {token.status === "CONFIRMED" && isDesignCompleted && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ marginBottom: 8 }}>Fitter Assignment</h3>
                  {canConfirm ? (
                    tokenFitterId ? (
                      <div style={{ color: "var(--text-secondary)" }}>
                        Assigned to: {token.fitter?.name || tokenFitterId} (
                        {fitterStatusLabel(normalizedFitterStatus)})
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "end",
                        }}
                      >
                        <div style={{ minWidth: 220 }}>
                          <label
                            style={{
                              display: "block",
                              fontSize: 12,
                              marginBottom: 4,
                            }}
                          >
                            Assign Fitter
                          </label>
                          <select
                            className="input"
                            value={selectedFitterId}
                            onChange={(e) =>
                              setSelectedFitterId(e.target.value)
                            }
                            disabled={submitting || loadingFitters}
                          >
                            <option value="">
                              {loadingFitters ? "Loading..." : "Select fitter"}
                            </option>
                            {fitters.map((f: any) => (
                              <option key={String(f.id)} value={String(f.id)}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          className="btn btn-primary"
                          onClick={handleAssignFitter}
                          disabled={submitting}
                        >
                          Assign Fitter
                        </button>
                      </div>
                    )
                  ) : (
                    <div style={{ color: "var(--text-secondary)" }}>
                      Only Owner/Manager can assign a fitter.
                    </div>
                  )}
                </div>
              )}

              {token.status === "CONFIRMED" && isDesignCompleted && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ marginBottom: 8 }}>Installation Progress</h3>
                  {canUpdateFitterStatus ? (
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        alignItems: "end",
                      }}
                    >
                      <div style={{ minWidth: 220 }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Status
                        </label>
                        <select
                          className="input"
                          value={installationStatusDraft}
                          disabled={
                            submitting || normalizedFitterStatus === "fitted"
                          }
                          onChange={(e) =>
                            setInstallationStatusDraft(
                              String(e.target.value) === "fitted"
                                ? "fitted"
                                : String(e.target.value) === "in_progress"
                                ? "in_progress"
                                : "pending"
                            )
                          }
                        >
                          <option value="pending" disabled>
                            Pending
                          </option>
                          <option
                            value="in_progress"
                            disabled={normalizedFitterStatus !== "pending"}
                          >
                            In Progress
                          </option>
                          <option
                            value="fitted"
                            disabled={normalizedFitterStatus !== "in_progress"}
                          >
                            Fitted
                          </option>
                        </select>
                      </div>

                      {installationStatusDraft === "fitted" && (
                        <div style={{ minWidth: 260 }}>
                          <label
                            style={{
                              display: "block",
                              fontSize: 12,
                              marginBottom: 4,
                            }}
                          >
                            Proof Images (required)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={submitting}
                            onChange={(e) =>
                              setInstallationProofFiles(
                                Array.from(e.target.files || [])
                              )
                            }
                          />
                        </div>
                      )}

                      <button
                        className="btn btn-primary"
                        disabled={
                          submitting || normalizedFitterStatus === "fitted"
                        }
                        onClick={handleInstallationSubmit}
                      >
                        Submit
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-secondary)" }}>
                      {isFitter
                        ? "Only the assigned fitter can update installation status."
                        : "Installation status will be updated by the assigned fitter."}
                    </div>
                  )}
                </div>
              )}

              {token.status === "CONFIRMED" && isDesignCompleted && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ marginBottom: 8 }}>Finalize Hoarding Status</h3>
                  {canFinalize ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        className="btn btn-primary"
                        disabled={
                          submitting ||
                          normalizedFitterStatus !== "fitted" ||
                          String(
                            token?.hoarding?.status || ""
                          ).toLowerCase() !== "live"
                        }
                        onClick={handleMarkBooked}
                      >
                        Mark as Booked
                      </button>
                      <div style={{ color: "var(--text-secondary)" }}>
                        Available after fitting is complete and hoarding is
                        Live.
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-secondary)" }}>
                      Only Owner/Manager/Sales can finalize.
                    </div>
                  )}
                </div>
              )}

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
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 220 }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Assign Designer
                        </label>
                        <select
                          className="input"
                          value={selectedDesignerId}
                          onChange={(e) =>
                            setSelectedDesignerId(e.target.value)
                          }
                          disabled={submitting || loadingDesigners}
                        >
                          <option value="">
                            {loadingDesigners
                              ? "Loading..."
                              : "Select designer"}
                          </option>
                          {designers.map((d: any) => (
                            <option key={String(d.id)} value={String(d.id)}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        disabled={submitting}
                      >
                        Confirm Token
                      </button>
                    </div>
                  )}
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
