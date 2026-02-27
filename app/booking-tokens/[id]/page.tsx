"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import CustomSelect from "@/components/CustomSelect";
import { bookingTokensAPI, hoardingsAPI } from "@/lib/api";
import { getRoleFromUser } from "@/lib/rbac";
import { useUser } from "@/components/AppLayout";
import { showError, showErrorNoTitle, showSuccess } from "@/lib/toast";

const executionTypeOptions = [
  { value: "CLIENT_DIRECT_FLEX", label: "Direct flex provided by client" },
  { value: "CLIENT_CDR", label: "Client provides CDR file" },
  { value: "IN_HOUSE_DESIGN", label: "In-house designing" },
];

const durationOptions = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "9", label: "9 months" },
  { value: "12", label: "1 year" },
  { value: "8d", label: "8 days" },
];

export default function BookingTokenDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userFromContext = useUser();

  const [user, setUser] = useState<any>(null);

  const tokenId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<any>(null);

  const [selectedExecutionType, setSelectedExecutionType] =
    useState<string>("");
  const [plannedLiveDateDraft, setPlannedLiveDateDraft] = useState<string>("");
  const [selectedDurationChoice, setSelectedDurationChoice] =
    useState<string>("");

  const [fitters, setFitters] = useState<any[]>([]);
  const [loadingFitters, setLoadingFitters] = useState(false);
  const [selectedFitterId, setSelectedFitterId] = useState<string>("");

  const [installationStatusDraft, setInstallationStatusDraft] = useState<
    "pending" | "in_progress" | "fitted"
  >("pending");
  const [installationProofFiles, setInstallationProofFiles] = useState<File[]>(
    [],
  );
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

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
  const fitterWorkflowEnabled = false;

  const canConfirm = useMemo(() => {
    return (
      roleLower === "owner" ||
      roleLower === "manager" ||
      roleLower === "admin" ||
      roleLower === "sales"
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
  const isFitter = false;

  const canCancel = useMemo(() => {
    return (
      roleLower === "owner" || roleLower === "manager" || roleLower === "admin"
    );
  }, [roleLower]);

  const canRelease = useMemo(() => {
    return (
      roleLower === "owner" ||
      roleLower === "manager" ||
      roleLower === "sales" ||
      roleLower === "admin"
    );
  }, [roleLower]);

  const canManageExtension = useMemo(() => {
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
    const raw = (token as any)?.plannedLiveDate;
    if (!raw) return;
    const d = new Date(String(raw));
    if (isNaN(d.getTime())) return;
    const next = d.toISOString().slice(0, 10);
    setPlannedLiveDateDraft((prev) => (prev ? prev : next));
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let resolved = "";
    const months = Number((token as any)?.durationMonths || 0);
    if (months > 0 && [1, 3, 6, 9, 12].includes(months)) {
      resolved = String(months);
    } else {
      const from = (token as any)?.dateFrom
        ? new Date(String((token as any).dateFrom))
        : null;
      const to = (token as any)?.dateTo
        ? new Date(String((token as any).dateTo))
        : null;
      if (from && to && !isNaN(from.getTime()) && !isNaN(to.getTime())) {
        const diffDays = Math.round(
          (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays === 8) {
          resolved = "8d";
        }
      }
    }

    setSelectedDurationChoice((prev) => (prev ? prev : resolved));
  }, [token]);

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
        setToken((prev: any) =>
          prev ? { ...prev, designStatus: payload.designStatus } : prev,
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

  // Live updates for fitter status
  useEffect(() => {
    if (!fitterWorkflowEnabled) return;
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
            : prev,
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
  }, [tokenId, fitterWorkflowEnabled]);

  const statusLabel = (raw?: string) => {
    const s = String(raw || "").toLowerCase();
    if (s === "active") return "Active";
    if (s === "pending") return "Queued";
    if (s === "blocked") return "Blocked";
    if (s === "extension_requested") return "Extension Requested";
    if (s === "confirmed") return "Confirmed";
    if (s === "approved") return "Approved";
    if (s === "released") return "Released";
    if (s === "expired") return "Expired";
    if (s === "cancelled") return "Cancelled";
    return raw || "—";
  };

  const legacyExtensionRequestedUntil = useMemo(() => {
    const apiValue = token?.legacyExtensionRequestedUntil;
    if (apiValue) {
      const d = new Date(String(apiValue));
      if (!Number.isNaN(d.getTime())) return d;
    }
    const notes = String(token?.notes || "");
    const m = notes.match(/\[\[EXT_REQ until=([^\]]+)\]\]/);
    if (!m || !m[1]) return null;
    const d = new Date(m[1]);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }, [token?.legacyExtensionRequestedUntil, token?.notes]);

  const isPhase3Payload = useMemo(() => {
    if (!token) return false;
    return (
      Object.prototype.hasOwnProperty.call(token, "blockedAt") ||
      Object.prototype.hasOwnProperty.call(token, "extensionRequestedUntil") ||
      Object.prototype.hasOwnProperty.call(token, "blockDurationHours")
    );
  }, [token]);

  const tokenStatusLower = String(token?.status || "").toLowerCase();
  const tokenStatusUpper = String(token?.status || "").toUpperCase();
  const hasLegacyExtensionRequest =
    !isPhase3Payload && !!legacyExtensionRequestedUntil;
  const isHeadToken =
    typeof token?.queuePosition === "number" ? token.queuePosition === 1 : true;
  const isBlockingToken = ["BLOCKED", "EXTENSION_REQUESTED", "ACTIVE"].includes(
    tokenStatusUpper,
  );
  const isActiveToken = isHeadToken && isBlockingToken;

  const isConfirmedLike =
    tokenStatusUpper === "CONFIRMED" || tokenStatusUpper === "APPROVED";
  const isReleasableToken = [
    "PENDING",
    "BLOCKED",
    "EXTENSION_REQUESTED",
    "ACTIVE",
  ].includes(tokenStatusUpper);

  const tokenSalesUserId = String(
    token?.salesUserId || token?.salesUser?.id || token?.salesUserId || "",
  );
  const isSalesOwnerOfToken =
    roleLower === "sales" &&
    tokenSalesUserId &&
    String(tokenSalesUserId) === String(user?.id || "");
  const hoardingStatusLower = String(token?.hoarding?.status || "")
    .toLowerCase()
    .trim();
  const actionsDisabledByHoardingStatus =
    hoardingStatusLower === "under_process" || hoardingStatusLower === "booked";

  const canConfirmThisToken =
    canConfirm && (roleLower !== "sales" || isSalesOwnerOfToken);
  const canRequestExtension =
    isSalesOwnerOfToken &&
    isHeadToken &&
    (isPhase3Payload
      ? ["BLOCKED", "ACTIVE"].includes(tokenStatusUpper)
      : tokenStatusUpper === "ACTIVE" && !hasLegacyExtensionRequest) &&
    !actionsDisabledByHoardingStatus;
  const canApproveOrRejectExtension =
    canManageExtension &&
    (isPhase3Payload
      ? tokenStatusUpper === "EXTENSION_REQUESTED"
      : hasLegacyExtensionRequest) &&
    !actionsDisabledByHoardingStatus;
  const canReleaseThisToken =
    canRelease && isReleasableToken && !actionsDisabledByHoardingStatus;

  const tokenDesignerId = String(
    token?.designerId || token?.designer?.id || "",
  );
  const tokenFitterId = String(token?.fitterId || token?.fitter?.id || "");
  const canUpdateDesignStatus =
    isDesigner &&
    tokenDesignerId &&
    String(tokenDesignerId) === String(user?.id || "");
  const canUpdateFitterStatus =
    fitterWorkflowEnabled &&
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
    return isConfirmedLike && normalizedDesignStatus === "completed";
  }, [isConfirmedLike, normalizedDesignStatus]);

  useEffect(() => {
    const existing = String(token?.hoarding?.executionType || "");
    if (existing && existing !== selectedExecutionType) {
      setSelectedExecutionType(existing);
    }
  }, [token?.hoarding?.executionType, selectedExecutionType]);

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

  // Load fitters for assignment after design is completed
  useEffect(() => {
    if (!fitterWorkflowEnabled) return;
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
    setShowFinalizeConfirm(false);

    // Pre-check (best-effort). Backend still enforces atomicity.
    if (hoardingStatusLower === "under_process") {
      showError("This hoarding is already Under Process");
      return;
    }

    try {
      setIsFinalizing(true);
      setSubmitting(true);
      if (!selectedExecutionType) {
        showError("Please select an execution type");
        return;
      }
      if (!selectedDurationChoice) {
        showError("Please select a duration");
        return;
      }

      const durationPayload: {
        durationMonths?: number;
        durationDays?: number;
      } = {};
      if (selectedDurationChoice.endsWith("d")) {
        const days = parseInt(selectedDurationChoice.replace("d", ""), 10) || 0;
        if (days <= 0) {
          showError("Invalid duration selection");
          return;
        }
        durationPayload.durationDays = days;
      } else {
        const months = Number(selectedDurationChoice);
        if (isNaN(months) || months <= 0) {
          showError("Invalid duration selection");
          return;
        }
        durationPayload.durationMonths = months;
      }

      const payload = {
        executionType: selectedExecutionType,
        plannedLiveDate:
          plannedLiveDateDraft || new Date().toISOString().slice(0, 10),
        ...durationPayload,
      };
      const resp = await bookingTokensAPI.confirm(tokenId, payload);
      if (resp?.success) {
        showSuccess("Token finalized");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to finalize");
      }
    } catch (e: any) {
      const msg = String(e?.response?.data?.message || "Failed to finalize");
      const lower = msg.toLowerCase();
      if (lower.includes("already") && lower.includes("under process")) {
        if (roleLower === "manager") {
          showErrorNoTitle(
            "By the time you confirm the token, it was already confirmed by other",
          );
          await fetchToken();
          return;
        }
        if (roleLower === "owner") {
          if (lower.includes("manager")) {
            showErrorNoTitle(
              "By the time you confirm the token, it was already confirmed by the manager",
            );
            await fetchToken();
            return;
          }
          showErrorNoTitle(
            "By the time you confirm the token, it was already confirmed by other",
          );
          await fetchToken();
          return;
        }
      }
      showError(msg);
    } finally {
      setSubmitting(false);
      setIsFinalizing(false);
    }
  };

  const handleOpenFinalizeConfirm = () => {
    if (submitting || isFinalizing) return;
    if (!selectedExecutionType) {
      showError("Please select an execution type");
      return;
    }
    if (!selectedDurationChoice) {
      showError("Please select a duration");
      return;
    }
    setShowFinalizeConfirm(true);
  };

  const handleDesignStatusUpdate = async (
    next: "pending" | "in_progress" | "completed",
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
        e?.response?.data?.message || "Failed to assign fitter",
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
        e?.response?.data?.message || "Failed to update installation status",
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
          installationProofFiles,
        );
        if (resp?.success) {
          showSuccess("Installation marked as fitted");
          await fetchToken();
        } else {
          showError(resp?.message || "Failed to complete installation");
        }
      } catch (e: any) {
        showError(
          e?.response?.data?.message || "Failed to complete installation",
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
      token?.hoarding?.status || "",
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

  const handleRelease = async () => {
    if (!tokenId) return;
    if (!confirm("Release this token?")) return;

    try {
      setSubmitting(true);
      const resp = await bookingTokensAPI.release(tokenId);
      if (resp?.success) {
        showSuccess("Token released");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to release");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to release");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestExtension = async () => {
    if (!tokenId) return;
    if (!confirm("Request extension for this token?")) return;

    try {
      setSubmitting(true);
      const resp = await bookingTokensAPI.requestExtension(tokenId);
      if (resp?.success) {
        showSuccess("Extension requested");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to request extension");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to request extension");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveExtension = async () => {
    if (!tokenId) return;
    if (!confirm("Approve extension request?")) return;

    try {
      setSubmitting(true);
      const resp = await bookingTokensAPI.approveExtension(tokenId);
      if (resp?.success) {
        showSuccess("Extension approved");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to approve extension");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to approve extension");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectExtension = async () => {
    if (!tokenId) return;
    if (!confirm("Reject extension request?")) return;

    try {
      setSubmitting(true);
      const resp = await bookingTokensAPI.rejectExtension(tokenId);
      if (resp?.success) {
        showSuccess("Extension rejected");
        await fetchToken();
      } else {
        showError(resp?.message || "Failed to reject extension");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to reject extension");
    } finally {
      setSubmitting(false);
    }
  };

  const hoardingId = String(token?.hoardingId || token?.hoarding?.id || "");
  const sectionStyle: React.CSSProperties = {
    marginTop: 16,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    background: "#f8fafc",
  };

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
          <h2 style={{ marginBottom: 4 }}>Booking Token Details</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
            Review token information and proceed with execution flow.
          </p>

          {loading ? (
            <div>Loading...</div>
          ) : !token ? (
            <div>Token not found</div>
          ) : (
            <>
              <div style={sectionStyle}>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>Status:</strong>{" "}
                    {statusLabel(
                      hasLegacyExtensionRequest
                        ? "extension_requested"
                        : token.status,
                    )}
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
                  {((tokenStatusUpper === "EXTENSION_REQUESTED" &&
                    token.extensionRequestedUntil) ||
                    hasLegacyExtensionRequest) && (
                    <div>
                      <strong>Requested Until:</strong>{" "}
                      {tokenStatusUpper === "EXTENSION_REQUESTED" &&
                      token.extensionRequestedUntil
                        ? new Date(
                            token.extensionRequestedUntil,
                          ).toLocaleString()
                        : legacyExtensionRequestedUntil
                          ? legacyExtensionRequestedUntil.toLocaleString()
                          : "—"}
                    </div>
                  )}
                  {isConfirmedLike && (
                    <div>
                      <strong>Design Status:</strong>{" "}
                      {designStatusLabel(normalizedDesignStatus)}
                    </div>
                  )}
                  {fitterWorkflowEnabled &&
                    isConfirmedLike &&
                    tokenFitterId && (
                      <div>
                        <strong>Installation Status:</strong>{" "}
                        {fitterStatusLabel(normalizedFitterStatus)}
                      </div>
                    )}
                </div>
              </div>

              <div
                style={{
                  ...sectionStyle,
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
                {fitterWorkflowEnabled && tokenFitterId && (
                  <div>
                    <strong>Fitter:</strong>{" "}
                    {token.fitter?.name || tokenFitterId}
                  </div>
                )}
                <div>
                  <strong>Duration:</strong>{" "}
                  {selectedDurationChoice
                    ? durationOptions.find(
                        (d) => d.value === selectedDurationChoice,
                      )?.label || "—"
                    : token.durationMonths
                      ? `${token.durationMonths} months`
                      : "—"}
                </div>
                <div>
                  <strong>Notes:</strong> {token.notes || "—"}
                </div>
              </div>

              <div style={sectionStyle}>
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

              {isConfirmedLike && (
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

              {fitterWorkflowEnabled &&
                isConfirmedLike &&
                isDesignCompleted && (
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
                                {loadingFitters
                                  ? "Loading..."
                                  : "Select fitter"}
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

              {fitterWorkflowEnabled &&
                isConfirmedLike &&
                isDesignCompleted && (
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
                                    : "pending",
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
                              disabled={
                                normalizedFitterStatus !== "in_progress"
                              }
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
                                  Array.from(e.target.files || []),
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

              {isConfirmedLike && isDesignCompleted && (
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
                            token?.hoarding?.status || "",
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

              <div style={sectionStyle}>
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
                {canRequestExtension && (
                  <button
                    className="btn btn-secondary btn-compact"
                    onClick={handleRequestExtension}
                    disabled={submitting}
                  >
                    Request Extension
                  </button>
                )}
                {canApproveOrRejectExtension && (
                  <>
                    <button
                      className="btn btn-secondary"
                      onClick={handleRejectExtension}
                      disabled={submitting}
                    >
                      Reject Extension
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleApproveExtension}
                      disabled={submitting}
                    >
                      Approve Extension
                    </button>
                  </>
                )}
                {canReleaseThisToken && (
                  <button
                    className="btn btn-secondary btn-compact"
                    onClick={handleRelease}
                    disabled={submitting}
                  >
                    Release Token
                  </button>
                )}
                {canCancel && isConfirmedLike && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleCancel}
                    disabled={submitting}
                  >
                    Cancel Token
                  </button>
                )}
                {canConfirmThisToken &&
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
                      <div style={{ minWidth: 260 }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Execution Type
                        </label>
                        <CustomSelect
                          value={selectedExecutionType}
                          onChange={setSelectedExecutionType}
                          options={executionTypeOptions}
                          placeholder="Select execution type"
                          openDirection="down"
                          className={
                            submitting ? "opacity-60 pointer-events-none" : ""
                          }
                        />
                      </div>
                      <div style={{ minWidth: 200 }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Duration
                        </label>
                        <CustomSelect
                          value={selectedDurationChoice}
                          onChange={setSelectedDurationChoice}
                          options={durationOptions}
                          placeholder="Select duration"
                          openDirection="down"
                          className={
                            submitting ? "opacity-60 pointer-events-none" : ""
                          }
                        />
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={handleOpenFinalizeConfirm}
                        disabled={submitting || isFinalizing}
                      >
                        {isFinalizing ? "Finalizing..." : "Finalize"}
                      </button>
                    </div>
                  )}
              </div>

              {showFinalizeConfirm && (
                <div
                  className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4"
                  onClick={() => setShowFinalizeConfirm(false)}
                >
                  <div
                    className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3
                      style={{
                        marginBottom: 8,
                        fontSize: 20,
                        color: "var(--text-primary)",
                      }}
                    >
                      Finalize Token
                    </h3>
                    <p
                      style={{
                        marginBottom: 16,
                        color: "var(--text-secondary)",
                      }}
                    >
                      Are you sure you want to finalize this token?
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 10,
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary !px-3 !py-2 !text-sm"
                        onClick={() => setShowFinalizeConfirm(false)}
                        disabled={submitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary !px-3 !py-2 !text-sm"
                        onClick={handleConfirm}
                        disabled={submitting || isFinalizing}
                      >
                        {isFinalizing ? "Finalizing..." : "Confirm"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
