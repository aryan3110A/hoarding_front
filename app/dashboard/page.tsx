"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import CustomSelect from "@/components/CustomSelect";
import {
  dashboardAPI,
  remindersAPI,
  notificationsAPI,
  hoardingsAPI,
  bookingsAPI,
  enquiriesAPI,
  bookingTokensAPI,
  proposalsAPI,
  supervisorAPI,
} from "@/lib/api";
import { canViewRent, canAssignTasks } from "@/lib/rbac";
import { showError, showSuccess } from "@/lib/toast";

function DashboardContent() {
  const [stats, setStats] = useState<any>(null);
  const [upcomingDues, setUpcomingDues] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sendingReminders, setSendingReminders] = useState(false);

  // Sales-specific data
  const [salesStats, setSalesStats] = useState<any>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [recentEnquiries, setRecentEnquiries] = useState<any[]>([]);
  const [myProposals, setMyProposals] = useState<any[]>([]);

  // Designer/Fitter-specific data
  const [tasks, setTasks] = useState<any[]>([]);
  const [fitterStatusDraftByTokenId, setFitterStatusDraftByTokenId] = useState<
    Record<string, "pending" | "in_progress" | "fitted">
  >({});
  const [fitterProofFilesByTokenId, setFitterProofFilesByTokenId] = useState<
    Record<string, File[]>
  >({});
  const [savingFitterByTokenId, setSavingFitterByTokenId] = useState<
    Record<string, boolean>
  >({});

  // Supervisor-specific data
  const [supervisorHoardings, setSupervisorHoardings] = useState<any[]>([]);
  const [designers, setDesigners] = useState<any[]>([]);
  const [execTypeDraft, setExecTypeDraft] = useState<Record<string, string>>(
    {},
  );
  const [designerDraft, setDesignerDraft] = useState<Record<string, string>>(
    {},
  );
  const [assigningById, setAssigningById] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedSupervisorClient, setSelectedSupervisorClient] =
    useState<string>("all");
  const [clientExecDraft, setClientExecDraft] = useState<
    Record<string, string>
  >({});
  const [clientDesignerDraft, setClientDesignerDraft] = useState<
    Record<string, string>
  >({});
  const [assigningClientKey, setAssigningClientKey] = useState<string | null>(
    null,
  );

  const user = useUser();
  const router = useRouter();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const userRole = user?.role?.toLowerCase() || "";
      console.log("Fetching dashboard data for role:", userRole);

      // Owner/Manager: Fetch rent overview
      if (["owner", "manager", "admin"].includes(userRole)) {
        try {
          const response = await dashboardAPI.getOwnerDashboard();
          console.log("Dashboard API response:", response);
          if (response && response.success && response.data) {
            setStats(response.data);
            setUpcomingDues(response.data.upcomingDues || []);
          } else {
            console.warn(
              "Dashboard API returned unexpected response:",
              response,
            );
            // If response is not successful, set empty stats
            setStats({
              totalHoardingsOnRent: 0,
              totalRentAmount: 0,
              totalAnnualizedRent: 0,
            });
            setUpcomingDues([]);
          }
        } catch (error) {
          console.error("Failed to fetch owner dashboard:", error);
          setStats({
            totalHoardingsOnRent: 0,
            totalRentAmount: 0,
            totalAnnualizedRent: 0,
          });
          setUpcomingDues([]);
        }
      }
      // Sales: Fetch hoardings, bookings, enquiries stats
      else if (userRole === "sales") {
        try {
          const [
            salesDashboardRes,
            hoardingsRes,
            bookingsRes,
            enquiriesRes,
            proposalsRes,
          ] = await Promise.allSettled([
            dashboardAPI.getSalesDashboard().catch(() => ({ data: null })),
            hoardingsAPI.getAll({ page: 1, limit: 1000 }),
            bookingsAPI
              .getAll(user?.id ? { createdBy: user.id } : undefined)
              .catch(() => ({ data: [] })),
            enquiriesAPI
              .getAll({ page: 1, limit: 100, assignedToMe: true })
              .catch(() => ({ data: [] })),
            proposalsAPI.list().catch(() => ({ success: true, data: [] })),
          ]);

          const salesDashboardData =
            salesDashboardRes.status === "fulfilled"
              ? salesDashboardRes.value?.data || salesDashboardRes.value || null
              : null;

          const hoardingsData =
            hoardingsRes.status === "fulfilled"
              ? hoardingsRes.value
              : { data: { total: 0, hoardings: [] } };
          const bookingsData =
            bookingsRes.status === "fulfilled"
              ? bookingsRes.value
              : { data: [] };
          const enquiriesData =
            enquiriesRes.status === "fulfilled"
              ? enquiriesRes.value
              : { data: [] };

          const proposalsData =
            proposalsRes.status === "fulfilled"
              ? proposalsRes.value
              : { data: [] };

          const hoardingsPayload = hoardingsData?.data || hoardingsData || {};
          const hoardings = Array.isArray(hoardingsPayload?.hoardings)
            ? hoardingsPayload.hoardings
            : [];

          const totalHoardings =
            Number(hoardingsPayload?.total) || hoardings.length || 0;
          const availableHoardings =
            Number(salesDashboardData?.availableHoardings) ||
            hoardings.filter((h: any) => {
              const status = String(h?.status || "").toLowerCase();
              return status === "available" || status === "live";
            }).length ||
            0;

          const bookingsPayload = bookingsData?.data || bookingsData || [];
          const bookings = Array.isArray(bookingsPayload)
            ? bookingsPayload
            : Array.isArray(bookingsPayload?.bookings)
              ? bookingsPayload.bookings
              : [];

          const enquiriesPayload = enquiriesData?.data || enquiriesData || {};
          const enquiries = Array.isArray(enquiriesPayload)
            ? enquiriesPayload
            : Array.isArray(enquiriesPayload?.inquiries)
              ? enquiriesPayload.inquiries
              : [];

          const proposals = proposalsData.data || [];
          setMyProposals(
            Array.isArray(proposals) ? proposals.slice(0, 10) : [],
          );

          // Get recent bookings (last 5)
          const recent = bookings
            .sort(
              (a: any, b: any) =>
                new Date(b.createdAt || b.startDate || 0).getTime() -
                new Date(a.createdAt || a.startDate || 0).getTime(),
            )
            .slice(0, 5);

          // Get recent enquiries (last 5)
          const recentEnq = enquiries
            .sort(
              (a: any, b: any) =>
                new Date(b.createdAt || b.created_at || 0).getTime() -
                new Date(a.createdAt || a.created_at || 0).getTime(),
            )
            .slice(0, 5);

          setSalesStats({
            totalHoardings,
            availableHoardings,
            totalBookings:
              Number(salesDashboardData?.myBookings) || bookings.length || 0,
            totalEnquiries:
              Number(salesDashboardData?.myEnquiries) ||
              Number(enquiriesPayload?.total) ||
              enquiries.length ||
              0,
            pendingEnquiries: enquiries.filter(
              (e: any) =>
                ["open", "pending", "new"].includes(
                  String(e?.status || "").toLowerCase(),
                ) ||
                String(e?.followupStatus || "").toLowerCase() === "pending",
            ).length,
          });
          setRecentBookings(recent);
          setRecentEnquiries(recentEnq);
        } catch (error) {
          console.error("Failed to fetch sales data:", error);
          // Set default values on error
          setSalesStats({
            totalHoardings: 0,
            availableHoardings: 0,
            totalBookings: 0,
            totalEnquiries: 0,
            pendingEnquiries: 0,
          });
          setRecentBookings([]);
          setRecentEnquiries([]);
          setMyProposals([]);
        }
      }
      // Designer: Fetch design tasks
      else if (userRole === "designer") {
        try {
          const response = await bookingTokensAPI.assigned();
          if (response.success && response.data) {
            const rows = Array.isArray(response.data)
              ? response.data
              : response.data || [];
            const designTasks = (rows || []).map((t: any) => {
              const statusRaw = String(
                t?.designStatus || "PENDING",
              ).toLowerCase();
              const status =
                statusRaw === "in_progress"
                  ? "in_progress"
                  : statusRaw === "completed"
                    ? "completed"
                    : "pending";
              return {
                id: String(t.id),
                tokenId: String(t.id),
                title: `Design for ${t?.hoarding?.code || "Hoarding"}`,
                status,
                hoardingCode: t?.hoarding?.code || t?.hoardingId,
                clientName: t?.client?.name || "N/A",
                dueDate: t?.createdAt,
              };
            });
            setTasks(designTasks);
          } else {
            setTasks([]);
          }
        } catch (error) {
          console.error("Failed to fetch design tasks:", error);
          setTasks([]);
        }
      }
      // Fitter: Fetch assigned installation jobs
      else if (userRole === "fitter") {
        try {
          const response = await bookingTokensAPI.assignedInstallations();
          if (response.success && response.data) {
            const rows = Array.isArray(response.data)
              ? response.data
              : response.data || [];
            const installationTasks = (rows || []).map((t: any) => {
              const statusRaw = String(
                t?.fitterStatus || "PENDING",
              ).toLowerCase();
              const status =
                statusRaw === "in_progress"
                  ? "in_progress"
                  : statusRaw === "completed"
                    ? "completed"
                    : "pending";
              const location = `${t?.hoarding?.city || ""}${
                t?.hoarding?.area ? ", " + t.hoarding.area : ""
              }`.trim();
              return {
                id: String(t.id),
                tokenId: String(t.id),
                title: `Installation for ${t?.hoarding?.code || "Hoarding"}`,
                status,
                hoardingCode: t?.hoarding?.code || t?.hoardingId,
                location: location || "N/A",
                clientName: t?.client?.name || "N/A",
                assignedDate: t?.fitterAssignedAt || t?.createdAt,
              };
            });
            setTasks(installationTasks);

            // Keep status drafts in sync (non-destructive for in-progress edits)
            setFitterStatusDraftByTokenId((prev) => {
              const next = { ...(prev || {}) };
              (installationTasks || []).forEach((t: any) => {
                const tokenId = String(t?.tokenId || t?.id);
                if (!tokenId) return;
                if (next[tokenId]) return;
                const normalized =
                  t?.status === "completed"
                    ? ("fitted" as const)
                    : t?.status === "in_progress"
                      ? ("in_progress" as const)
                      : ("pending" as const);
                next[tokenId] = normalized;
              });
              return next;
            });
          } else {
            setTasks([]);
          }
        } catch (error) {
          console.error("Failed to fetch installation jobs:", error);
          setTasks([]);
        }
      }
      // Supervisor: Fetch booked hoardings + designers for assignment
      else if (userRole === "supervisor") {
        try {
          const [hoardingsRes, designersRes] = await Promise.allSettled([
            supervisorAPI.listHoardings({ limit: 1000 }),
            supervisorAPI.listDesigners(),
          ]);

          const hoardingsData =
            hoardingsRes.status === "fulfilled" ? hoardingsRes.value : null;
          const designersData =
            designersRes.status === "fulfilled" ? designersRes.value : null;

          const rows = hoardingsData?.rows || hoardingsData?.data?.rows || [];
          setSupervisorHoardings(Array.isArray(rows) ? rows : []);

          const dList = designersData?.data || designersData || [];
          setDesigners(Array.isArray(dList) ? dList : []);
        } catch (error) {
          console.error("Failed to fetch supervisor data:", error);
          setSupervisorHoardings([]);
          setDesigners([]);
        }
      } else {
        // Unknown role - set empty state
        setStats(null);
        setUpcomingDues([]);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setStats(null);
      setUpcomingDues([]);
    } finally {
      // Always set loading to false
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      if (response.success && response.data) {
        setUnreadCount(response.data.count || 0);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  const handleSendReminders = async () => {
    if (
      !confirm(
        "Send rent reminders for landlords/properties due in the next 7 days?",
      )
    ) {
      return;
    }

    try {
      setSendingReminders(true);
      const response = await remindersAPI.sendReminders(7);
      if (response.success) {
        alert(
          `Reminders sent successfully! ${
            response.data?.sent || 0
          } emails sent.`,
        );
        fetchDashboardData();
        fetchUnreadCount();
      } else {
        alert(
          "Failed to send reminders: " + (response.message || "Unknown error"),
        );
      }
    } catch (error: any) {
      alert(
        "Error sending reminders: " +
          (error.response?.data?.message || "Unknown error"),
      );
    } finally {
      setSendingReminders(false);
    }
  };

  const userRole = user?.role || "";
  const userRoleLower = userRole?.toLowerCase() || "";

  const capitalize = (s?: string | null) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const displayRole = user?.role ? capitalize(user.role) : "User";
  const canViewRentInfo = canViewRent(userRole);
  const executionTypeOptions = [
    { value: "", label: "Select..." },
    { value: "CLIENT_CDR", label: "Client CDR" },
    { value: "IN_HOUSE_DESIGN", label: "In-House Design" },
    { value: "CLIENT_DIRECT_FLEX", label: "Client Direct Flex" },
  ];
  const designerOptions = [
    { value: "", label: "Select designer..." },
    ...(designers || []).map((d: any) => ({
      value: String(d.id || ""),
      label: d.name || d.email || d.id,
    })),
  ];

  const getSupervisorClientKey = (h: any) =>
    String(
      h?.clientId ||
        h?.latestClientId ||
        h?.client?.id ||
        h?.clientName ||
        h?.latestClientName ||
        "unknown-client",
    );

  const getSupervisorClientName = (h: any) =>
    String(
      h?.clientName ||
        h?.latestClientName ||
        h?.client?.name ||
        h?.client?.companyName ||
        "Unknown Client",
    );

  const getSupervisorClientPhone = (h: any) =>
    String(
      h?.clientPhone ||
        h?.latestClientPhone ||
        h?.client?.phone ||
        h?.clientContact ||
        "",
    );

  const getSupervisorDesignerId = (h: any) =>
    String(h?.designerId || h?.latestDesignerId || h?.designer?.id || "");

  const isSupervisorAssignmentLocked = (h: any) => {
    const statusLower = String(h?.status || "").toLowerCase();
    const designStatusLower = String(
      h?.latestDesignStatus || h?.designStatus || "",
    ).toLowerCase();
    return (
      designStatusLower === "in_progress" ||
      (statusLower === "live" && designStatusLower === "completed")
    );
  };

  const getSupervisorLockReason = (h: any) => {
    const designStatusLower = String(
      h?.latestDesignStatus || h?.designStatus || "",
    ).toLowerCase();
    if (designStatusLower === "in_progress") {
      return "Assignment locked because design is in progress";
    }
    return "Assignment locked for Live + Completed hoarding";
  };

  const supervisorClientGroups = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; name: string; phone: string; rows: any[] }
    >();

    (supervisorHoardings || []).forEach((h: any) => {
      const key = getSupervisorClientKey(h);
      const existing = groups.get(key);
      if (existing) {
        existing.rows.push(h);
        if (!existing.phone) existing.phone = getSupervisorClientPhone(h);
        return;
      }

      groups.set(key, {
        key,
        name: getSupervisorClientName(h),
        phone: getSupervisorClientPhone(h),
        rows: [h],
      });
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [supervisorHoardings]);

  const supervisorClientOptions = [
    { value: "all", label: "All Clients" },
    ...supervisorClientGroups.map((group) => ({
      value: group.key,
      label: `${group.name} (${group.rows.length})`,
    })),
  ];

  const selectedSupervisorGroup =
    selectedSupervisorClient === "all"
      ? null
      : supervisorClientGroups.find(
          (group) => group.key === selectedSupervisorClient,
        ) || null;

  const visibleSupervisorGroups = selectedSupervisorGroup
    ? [selectedSupervisorGroup]
    : [];

  // Debug: Log user object to see what we're working with
  useEffect(() => {
    if (user) {
      console.log("Dashboard - User object:", user);
      console.log("Dashboard - User role:", userRole);
      console.log("Dashboard - Can view rent:", canViewRentInfo);
      fetchDashboardData();
      fetchUnreadCount();

      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    } else {
      // If no user, stop loading
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedSupervisorClient === "all") return;
    const stillExists = supervisorClientGroups.some(
      (group) => group.key === selectedSupervisorClient,
    );
    if (!stillExists) setSelectedSupervisorClient("all");
  }, [selectedSupervisorClient, supervisorClientGroups]);

  // Real-time: keep fitter task statuses updated
  useEffect(() => {
    if (!user) return;
    if (userRoleLower !== "fitter") return;

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
        };
        if (!payload?.tokenId || !payload.fitterStatus) return;
        const statusRaw = String(payload.fitterStatus).toLowerCase();
        const status =
          statusRaw === "in_progress"
            ? "in_progress"
            : statusRaw === "completed"
              ? "completed"
              : "pending";
        setTasks((prev) =>
          (prev || []).map((t: any) =>
            String(t?.tokenId || t?.id) === String(payload.tokenId)
              ? { ...t, status }
              : t,
          ),
        );

        // If we haven't started editing this row, keep draft aligned.
        setFitterStatusDraftByTokenId((prev) => {
          const tokenId = String(payload.tokenId);
          if (!tokenId) return prev;
          if (prev?.[tokenId]) return prev;
          const normalized =
            status === "completed"
              ? ("fitted" as const)
              : status === "in_progress"
                ? ("in_progress" as const)
                : ("pending" as const);
          return { ...(prev || {}), [tokenId]: normalized };
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userRoleLower]);

  const normalizedFitterStatus = (s?: string | null) => {
    const raw = String(s || "").toLowerCase();
    if (raw === "completed" || raw === "fitted") return "fitted" as const;
    if (raw === "in_progress") return "in_progress" as const;
    return "pending" as const;
  };

  const handleSaveFitterRow = async (
    tokenId: string,
    currentStatus?: string,
  ) => {
    if (!tokenId) return;
    const draft = fitterStatusDraftByTokenId[String(tokenId)] || "pending";
    const current = normalizedFitterStatus(currentStatus);
    try {
      setSavingFitterByTokenId((prev) => ({
        ...(prev || {}),
        [String(tokenId)]: true,
      }));

      if (current === "fitted") {
        showError("Already fitted");
        return;
      }
      if (draft === "pending") {
        showError("Cannot move back to pending");
        return;
      }

      if (draft === "fitted") {
        if (current !== "in_progress") {
          showError("Must be in progress before fitting");
          return;
        }
        const files = fitterProofFilesByTokenId[String(tokenId)] || [];
        if (!files.length) {
          showError("Please upload at least 1 proof image.");
          return;
        }
        const resp = await bookingTokensAPI.completeInstallation(
          String(tokenId),
          files,
        );
        if (resp?.success) {
          showSuccess("Installation marked as fitted");
          // refresh list so counts and status sync
          await fetchDashboardData();
        } else {
          showError(resp?.message || "Failed to complete installation");
        }
        return;
      }

      if (draft === "in_progress" && current !== "pending") {
        showError("Cannot mark in progress");
        return;
      }

      const resp = await bookingTokensAPI.updateFitterStatus(
        String(tokenId),
        draft,
      );
      if (resp?.success) {
        showSuccess("Installation status updated");
        await fetchDashboardData();
      } else {
        showError(resp?.message || "Failed to update installation status");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to update installation");
    } finally {
      setSavingFitterByTokenId((prev) => ({
        ...(prev || {}),
        [String(tokenId)]: false,
      }));
    }
  };

  // Supervisor: assign execution type + designer
  const handleAssignExecution = async (
    hoardingId: string,
    hoardingStatus?: string | null,
    latestDesignStatus?: string | null,
    currentExecutionType?: string | null,
    currentDesignerId?: string | null,
  ) => {
    if (!hoardingId) return;
    const statusLower = String(hoardingStatus || "").toLowerCase();
    const designStatusLower = String(latestDesignStatus || "").toLowerCase();
    if (
      designStatusLower === "in_progress" ||
      (statusLower === "live" && designStatusLower === "completed")
    ) {
      showError(
        designStatusLower === "in_progress"
          ? "Cannot assign while design is in progress."
          : "Cannot assign when hoarding is Live and design is Completed.",
      );
      return;
    }
    const execType = execTypeDraft[hoardingId] || currentExecutionType || "";
    const requiresDesigner = execType !== "CLIENT_DIRECT_FLEX";
    const designerId = designerDraft[hoardingId] || currentDesignerId || "";
    if (!execType) {
      showError("Please select an execution type");
      return;
    }
    if (requiresDesigner && !designerId) {
      showError("Please select a designer");
      return;
    }
    try {
      setAssigningById((prev) => ({ ...prev, [hoardingId]: true }));
      const payload: { executionType: string; designerId?: string } = {
        executionType: execType,
      };
      if (requiresDesigner) {
        payload.designerId = designerId;
      }
      const resp = await supervisorAPI.setExecutionType(hoardingId, payload);
      if (resp?.success !== false) {
        showSuccess(
          requiresDesigner
            ? "Execution type assigned successfully"
            : "Execution type confirmed successfully",
        );
        await fetchDashboardData();
      } else {
        showError(resp?.message || "Failed to assign");
      }
    } catch (e: any) {
      showError(
        e?.response?.data?.message || "Failed to assign execution type",
      );
    } finally {
      setAssigningById((prev) => ({ ...prev, [hoardingId]: false }));
    }
  };

  const handleAssignClientHoardings = async (clientKey: string) => {
    const group = supervisorClientGroups.find((g) => g.key === clientKey);
    if (!group) {
      showError("Please select a client");
      return;
    }

    const execType = clientExecDraft[clientKey] || "";
    const requiresDesigner = execType !== "CLIENT_DIRECT_FLEX";
    const designerId = clientDesignerDraft[clientKey] || "";

    if (!execType) {
      showError("Please select an execution type for this client");
      return;
    }

    if (requiresDesigner && !designerId) {
      showError("Please select a designer for this client");
      return;
    }

    const assignableRows = group.rows.filter(
      (h: any) => !isSupervisorAssignmentLocked(h),
    );
    if (assignableRows.length === 0) {
      showError("No unlocked hoardings available for this client");
      return;
    }

    try {
      setAssigningClientKey(clientKey);
      setAssigningById((prev) => {
        const next = { ...(prev || {}) };
        assignableRows.forEach((h: any) => {
          if (h?.id) next[String(h.id)] = true;
        });
        return next;
      });

      const payload: { executionType: string; designerId?: string } = {
        executionType: execType,
      };
      if (requiresDesigner) {
        payload.designerId = designerId;
      }

      const results = await Promise.allSettled(
        assignableRows.map((h: any) =>
          supervisorAPI.setExecutionType(String(h.id), payload),
        ),
      );
      const successCount = results.filter(
        (result) =>
          result.status === "fulfilled" && result.value?.success !== false,
      ).length;
      const failedCount = assignableRows.length - successCount;

      if (successCount > 0) {
        showSuccess(`Assigned ${successCount} hoarding(s) for ${group.name}`);
        await fetchDashboardData();
      }
      if (failedCount > 0) {
        showError(`${failedCount} hoarding(s) could not be assigned`);
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to assign client rows");
    } finally {
      setAssigningClientKey(null);
      setAssigningById((prev) => {
        const next = { ...(prev || {}) };
        assignableRows.forEach((h: any) => {
          if (h?.id) next[String(h.id)] = false;
        });
        return next;
      });
    }
  };

  const renderSupervisorHoardingRows = (rows: any[]) =>
    rows.map((h: any) => {
      const hid = String(h.id);
      const lockAssignAction = isSupervisorAssignmentLocked(h);
      const currentExec = h.executionType || "";
      const selectedExec = execTypeDraft[hid] || currentExec || "";
      const requiresDesigner =
        !!selectedExec && selectedExec !== "CLIENT_DIRECT_FLEX";
      const selectedDesigner = designerDraft[hid] || getSupervisorDesignerId(h);
      const saving = assigningById[hid] || false;
      const isClientFlex = selectedExec === "CLIENT_DIRECT_FLEX";

      return (
        <tr key={hid}>
          <td>
            <div className="supervisor-hoarding-code">{h.code || hid}</div>
            <div className="supervisor-hoarding-location">
              {[h.city, h.area].filter(Boolean).join(", ") || "-"}
            </div>
          </td>
          <td>
            <span className="supervisor-pill status-pill">
              {(h.status || "unknown").replace(/_/g, " ").toUpperCase()}
            </span>
          </td>
          <td>
            <span className="supervisor-pill design-pill">
              {h.latestDesignStatus
                ? String(h.latestDesignStatus).replace(/_/g, " ").toUpperCase()
                : "-"}
            </span>
          </td>
          <td className="supervisor-text-cell">
            {currentExec ? currentExec.replace(/_/g, " ") : "-"}
          </td>
          <td>
            <CustomSelect
              value={selectedExec}
              onChange={(value) => {
                setExecTypeDraft((prev) => ({
                  ...prev,
                  [hid]: value,
                }));
                if (value === "CLIENT_DIRECT_FLEX") {
                  setDesignerDraft((prev) => {
                    const next = { ...(prev || {}) };
                    delete next[hid];
                    return next;
                  });
                }
              }}
              options={executionTypeOptions}
              placeholder="Select..."
              className="supervisor-custom-select"
              disabled={saving || lockAssignAction}
            />
          </td>
          <td>
            {requiresDesigner ? (
              <CustomSelect
                value={selectedDesigner}
                onChange={(value) =>
                  setDesignerDraft((prev) => ({
                    ...prev,
                    [hid]: value,
                  }))
                }
                options={designerOptions}
                placeholder="Select designer..."
                className="supervisor-custom-select"
                disabled={saving || lockAssignAction}
              />
            ) : (
              <span className="supervisor-muted">N/A</span>
            )}
          </td>
          <td>
            <button
              className="btn btn-primary supervisor-assign-btn"
              disabled={
                lockAssignAction ||
                saving ||
                !selectedExec ||
                (requiresDesigner && !selectedDesigner)
              }
              onClick={() =>
                handleAssignExecution(
                  hid,
                  h.status,
                  h.latestDesignStatus,
                  currentExec,
                  selectedDesigner,
                )
              }
              title={
                lockAssignAction
                  ? getSupervisorLockReason(h)
                  : isClientFlex
                    ? "Confirm Client Direct Flex"
                    : "Assign execution/designer"
              }
            >
              {lockAssignAction
                ? "Locked"
                : saving
                  ? "Saving..."
                  : isClientFlex
                    ? "Confirm"
                    : "Assign"}
            </button>
          </td>
        </tr>
      );
    });

  const LoadingAnimation = ({ label }: { label: string }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 8,
        color: "var(--text-secondary)",
        fontWeight: 600,
      }}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          borderRadius: 9999,
          border: "3px solid var(--brand-blue)",
          borderTopColor: "var(--brand-orange)",
          borderRightColor: "var(--brand-yellow)",
          boxShadow: "0 0 0 1px rgba(31, 92, 169, 0.18)",
          display: "inline-block",
          flex: "0 0 auto",
          animation: "spin 0.9s linear infinite",
        }}
      />
      <span>{label}</span>
    </div>
  );

  return (
    <>
      <div>
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <h1 style={{ color: "#fff" }}>Dashboard</h1>
              <p
                style={{
                  color: "rgba(255,255,255)",
                  fontSize: "16px",
                  marginTop: "0px",
                }}
              >
                Welcome back, <strong>{displayRole}</strong>! Here's your
                overview.
              </p>
            </div>
            {/* user card removed per request to keep navbar compact */}
          </div>
        </div>

        {/* Notification Badge */}
        {unreadCount > 0 && (
          <div
            className="card"
            style={{
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              border: "2px solid #f59e0b",
              cursor: "pointer",
              marginBottom: "24px",
            }}
            onClick={() => router.push("/notifications")}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "#92400e" }}>
                  🔔 {unreadCount} Unread Notification
                  {unreadCount !== 1 ? "s" : ""}
                </h3>
                <p style={{ margin: "8px 0 0 0", color: "#78350f" }}>
                  Click to view notifications
                </p>
              </div>
              <div style={{ fontSize: "24px" }}>→</div>
            </div>
          </div>
        )}

        {loading && (
          <div className="card" style={{ marginBottom: "24px" }}>
            <LoadingAnimation label="Loading data..." />
          </div>
        )}

        {/* Rent Overview Cards - Only for Owner/Manager */}
        {canViewRentInfo && (
          <>
            <div className="grid">
              {stats?.mode === "property" ? (
                <>
                  <div className="stat-card">
                    <h3>{stats?.totalProperties || 0}</h3>
                    <p>Total Landlords on Rent</p>
                  </div>
                  <div className="stat-card">
                    <h3>
                      ₹
                      {Number(
                        stats?.totalMonthlyRentLoad || 0,
                      ).toLocaleString()}
                    </h3>
                    <p>Total Monthly Landlord Rent</p>
                  </div>
                  <div className="stat-card">
                    <h3>
                      ₹
                      {Number(stats?.totalAnnualizedRent || 0).toLocaleString()}
                    </h3>
                    <p>Annualized Landlord Rent</p>
                  </div>
                  <div className="stat-card">
                    <h3>{(stats?.upcomingDues || []).length}</h3>
                    <p>Upcoming Due (14d)</p>
                  </div>
                  <div className="stat-card">
                    <h3>{(stats?.overduePayments || []).length}</h3>
                    <p>Overdue Payments</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="stat-card">
                    <h3>{stats?.totalHoardingsOnRent || 0}</h3>
                    <p>Total Landlords on Rent</p>
                  </div>
                  <div className="stat-card">
                    <h3>
                      ₹{Number(stats?.totalRentAmount || 0).toLocaleString()}
                    </h3>
                    <p>Total Monthly Landlord Rent</p>
                  </div>
                  <div className="stat-card">
                    <h3>
                      ₹
                      {Number(stats?.totalAnnualizedRent || 0).toLocaleString()}
                    </h3>
                    <p>Annualized Landlord Rent</p>
                  </div>
                  <div className="stat-card">
                    <h3>{upcomingDues.length}</h3>
                    <p>Upcoming Landlord Rent Dues</p>
                  </div>
                </>
              )}
            </div>

            {/* Send Reminders Button */}
            <div className="card" style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>Rent Reminders</h3>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      margin: "8px 0 0 0",
                    }}
                  >
                    Send email reminders for landlord/property rents due in the
                    next 7 days
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleSendReminders}
                  disabled={sendingReminders}
                >
                  {sendingReminders ? "Sending..." : "Send Reminders Now"}
                </button>
              </div>
            </div>

            {/* Upcoming Rent Dues */}
            {loading ? (
              <div className="card">
                <h3>Upcoming Landlord Rent Due</h3>
                <LoadingAnimation label="Loading rent dues..." />
              </div>
            ) : upcomingDues.length > 0 ? (
              <div className="card">
                <h3>Upcoming Landlord Rent Due (Next 5)</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>
                        {stats?.mode === "property"
                          ? "Landlord"
                          : "Hoarding Code"}
                      </th>
                      <th>Location</th>
                      <th>
                        {stats?.mode === "property"
                          ? "Payment Frequency"
                          : "Party Type"}
                      </th>
                      <th>Rent Amount</th>
                      <th>Next Due Date</th>
                      <th>Days Until Due</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingDues.map((rent: any) => {
                      const dueDate = rent.nextDueDate
                        ? new Date(rent.nextDueDate)
                        : null;
                      const today = new Date();
                      const daysUntilDue = dueDate
                        ? Math.ceil(
                            (dueDate.getTime() - today.getTime()) /
                              (1000 * 60 * 60 * 24),
                          )
                        : null;
                      const isOverdue =
                        daysUntilDue !== null && daysUntilDue < 0;
                      const isUrgent =
                        daysUntilDue !== null &&
                        daysUntilDue <= 7 &&
                        daysUntilDue >= 0;

                      return (
                        <tr
                          key={rent.id}
                          style={
                            isOverdue
                              ? { backgroundColor: "#ffebee" } // Red tint for overdue
                              : isUrgent
                                ? { backgroundColor: "#fff3cd" } // Yellow tint for urgent
                                : {}
                          }
                        >
                          <td>
                            <strong>
                              {stats?.mode === "property"
                                ? rent.landlord || "N/A"
                                : rent.hoarding?.code || "N/A"}
                            </strong>
                          </td>
                          <td>
                            {stats?.mode === "property"
                              ? rent.location ||
                                [
                                  rent.hoardings?.[0]?.city || "",
                                  rent.hoardings?.[0]?.area || "",
                                ]
                                  .filter(Boolean)
                                  .join(", ") ||
                                "N/A"
                              : `${rent.hoarding?.city || ""}${rent.hoarding?.area ? `, ${rent.hoarding.area}` : ""}` ||
                                "N/A"}
                          </td>
                          <td>
                            <span className="badge badge-info">
                              {stats?.mode === "property"
                                ? rent.paymentFrequency || "N/A"
                                : rent.partyType}
                            </span>
                          </td>
                          <td>₹{Number(rent.rentAmount).toLocaleString()}</td>
                          <td>
                            {dueDate ? dueDate.toLocaleDateString() : "N/A"}
                          </td>
                          <td>
                            {daysUntilDue !== null ? (
                              <span
                                className={`badge ${
                                  isOverdue
                                    ? "badge-danger"
                                    : isUrgent
                                      ? "badge-warning"
                                      : "badge-success"
                                }`}
                              >
                                {daysUntilDue === 0
                                  ? "Due Today"
                                  : daysUntilDue < 0
                                    ? `Overdue by ${Math.abs(daysUntilDue)} days`
                                    : `${daysUntilDue} days`}
                              </span>
                            ) : (
                              "N/A"
                            )}
                          </td>
                          <td>
                            {stats?.mode === "property" ? (
                              <button
                                className="btn btn-primary"
                                style={{
                                  padding: "5px 10px",
                                  fontSize: "12px",
                                }}
                                onClick={() => {
                                  const landlord = String(
                                    rent.landlord || "",
                                  ).trim();
                                  if (landlord) {
                                    router.push(
                                      `/landlords/${encodeURIComponent(landlord)}/rent`,
                                    );
                                    return;
                                  }
                                  if (rent.propertyGroupId) {
                                    router.push(
                                      `/property-rents/${encodeURIComponent(String(rent.propertyGroupId))}`,
                                    );
                                  }
                                }}
                                disabled={
                                  !rent.landlord && !rent.propertyGroupId
                                }
                              >
                                Edit Rent
                              </button>
                            ) : (
                              <button
                                className="btn btn-primary"
                                style={{
                                  padding: "5px 10px",
                                  fontSize: "12px",
                                }}
                                onClick={() =>
                                  router.push(
                                    `/hoardings/${rent.hoardingId}/rent`,
                                  )
                                }
                              >
                                View Rent
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card">
                <h3>Upcoming Landlord Rent Due</h3>
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    📅
                  </div>
                  <p style={{ marginTop: "8px" }}>
                    No upcoming landlord rent dues at the moment.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Sales Dashboard */}
        {userRoleLower === "sales" && (
          <>
            <div className="grid">
              <div className="stat-card">
                <h3>
                  {loading ? (
                    <span className="loading-value animate-pulse">•••</span>
                  ) : (
                    salesStats?.totalHoardings || 0
                  )}
                </h3>
                <p>Total Hoardings</p>
              </div>
              <div className="stat-card">
                <h3>
                  {loading ? (
                    <span className="loading-value animate-pulse">•••</span>
                  ) : (
                    salesStats?.availableHoardings || 0
                  )}
                </h3>
                <p>Available Hoardings</p>
              </div>
              <div className="stat-card">
                <h3>
                  {loading ? (
                    <span className="loading-value animate-pulse">•••</span>
                  ) : (
                    salesStats?.totalBookings || 0
                  )}
                </h3>
                <p>Total Bookings</p>
              </div>
              <div className="stat-card">
                <h3>
                  {loading ? (
                    <span className="loading-value animate-pulse">•••</span>
                  ) : (
                    salesStats?.totalEnquiries || 0
                  )}
                </h3>
                <p>Total Enquiries</p>
              </div>
              <div className="stat-card">
                <h3>
                  {loading ? (
                    <span className="loading-value animate-pulse">•••</span>
                  ) : (
                    salesStats?.pendingEnquiries || 0
                  )}
                </h3>
                <p>Pending Enquiries</p>
              </div>
            </div>

            {/* Recent Bookings */}
            {loading ? (
              <div className="card" style={{ marginTop: "24px" }}>
                <h3>Recent Bookings</h3>
                <LoadingAnimation label="Loading bookings..." />
              </div>
            ) : recentBookings && recentBookings.length > 0 ? (
              <div className="card" style={{ marginTop: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <h3>Recent Bookings</h3>
                  <button
                    className="btn btn-primary"
                    onClick={() => router.push("/bookings")}
                    style={{ padding: "8px 16px", fontSize: "14px" }}
                  >
                    View All
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hoarding</th>
                      <th>Client</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking: any) => (
                      <tr key={booking.id}>
                        <td>
                          {booking.hoarding?.code ||
                            booking.hoardingId ||
                            "N/A"}
                        </td>
                        <td>
                          {booking.clientName || booking.clientId || "N/A"}
                        </td>
                        <td>
                          {booking.startDate
                            ? new Date(booking.startDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td>
                          {booking.endDate
                            ? new Date(booking.endDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              booking.status === "confirmed"
                                ? "badge-success"
                                : "badge-warning"
                            }`}
                          >
                            {booking.status || "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card" style={{ marginTop: "24px" }}>
                <h3>Recent Bookings</h3>
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    📅
                  </div>
                  <p style={{ marginTop: "8px" }}>No bookings yet.</p>
                </div>
              </div>
            )}

            {/* Recent Enquiries */}
            {loading ? (
              <div className="card" style={{ marginTop: "24px" }}>
                <h3>Recent Enquiries</h3>
                <LoadingAnimation label="Loading enquiries..." />
              </div>
            ) : recentEnquiries && recentEnquiries.length > 0 ? (
              <div className="card" style={{ marginTop: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <h3>Recent Enquiries</h3>
                  <button
                    className="btn btn-primary"
                    onClick={() => router.push("/enquiries")}
                    style={{ padding: "8px 16px", fontSize: "14px" }}
                  >
                    View All
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Client Name</th>
                      <th>Contact</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEnquiries.map((enquiry: any) => (
                      <tr key={enquiry.id}>
                        <td>{enquiry.clientName || "N/A"}</td>
                        <td>{enquiry.contact || "N/A"}</td>
                        <td>{enquiry.source || "N/A"}</td>
                        <td>
                          <span
                            className={`badge ${
                              enquiry.status === "converted"
                                ? "badge-success"
                                : enquiry.status === "pending"
                                  ? "badge-warning"
                                  : "badge-info"
                            }`}
                          >
                            {enquiry.status || "New"}
                          </span>
                        </td>
                        <td>
                          {enquiry.createdAt
                            ? new Date(enquiry.createdAt).toLocaleDateString()
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card" style={{ marginTop: "24px" }}>
                <h3>Recent Enquiries</h3>
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    📋
                  </div>
                  <p style={{ marginTop: "8px" }}>No enquiries yet.</p>
                </div>
              </div>
            )}

            {/* My Proposals */}
            <div className="card" style={{ marginTop: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h3>My Proposals</h3>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/proposals")}
                  style={{ padding: "8px 16px", fontSize: "14px" }}
                >
                  View All
                </button>
              </div>

              {myProposals.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
                  No proposals yet.
                </p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Proposal</th>
                      <th>Client</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myProposals.map((p: any) => (
                      <tr key={p.id}>
                        <td
                          style={{ fontFamily: "monospace", fontSize: "12px" }}
                        >
                          {String(p.id || "").slice(0, 8)}
                        </td>
                        <td>{p?.client?.name || "N/A"}</td>
                        <td>{p?.status || "—"}</td>
                        <td>
                          {p?.createdAt
                            ? new Date(p.createdAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="btn btn-secondary"
                              onClick={() => router.push(`/proposals/${p.id}`)}
                              style={{ padding: "6px 10px", fontSize: "12px" }}
                            >
                              View
                            </button>

                            {p.status === "DRAFT" && (
                              <button
                                className="btn btn-secondary"
                                onClick={() =>
                                  router.push(`/proposals/${p.id}/edit`)
                                }
                                style={{
                                  padding: "6px 10px",
                                  fontSize: "12px",
                                }}
                              >
                                Open Builder
                              </button>
                            )}

                            {p.status === "DRAFT" && (
                              <button
                                className="btn btn-primary"
                                onClick={() =>
                                  router.push(`/proposals/${p.id}/finalize`)
                                }
                                style={{
                                  padding: "6px 10px",
                                  fontSize: "12px",
                                }}
                              >
                                Finalize
                              </button>
                            )}

                            <button
                              className="btn btn-primary"
                              onClick={async () => {
                                try {
                                  const resp = await proposalsAPI.downloadPdf(
                                    String(p.id),
                                  );
                                  const blob = new Blob([resp.data], {
                                    type: "application/pdf",
                                  });
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `proposal-${p.id}.pdf`;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                } catch {
                                  showError("Failed to download PDF");
                                }
                              }}
                              style={{ padding: "6px 10px", fontSize: "12px" }}
                            >
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Quick Actions for Sales */}
            <div className="card" style={{ marginTop: "24px" }}>
              <h3>Quick Actions</h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  marginTop: "8px",
                  marginBottom: "16px",
                }}
              >
                As a Sales team member, you have access to hoardings, bookings,
                and enquiries. Rent management is handled by Owner/Manager.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/hoardings")}
                >
                  View Hoardings
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/bookings")}
                >
                  View Bookings
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/enquiries")}
                >
                  View Enquiries
                </button>
              </div>
            </div>
          </>
        )}

        {/* Designer Dashboard */}
        {userRoleLower === "designer" && (
          <>
            <div className="grid">
              <div className="stat-card">
                <h3>
                  {tasks.filter((t: any) => t.status === "pending").length}
                </h3>
                <p>Pending Designs</p>
              </div>
              <div className="stat-card">
                <h3>
                  {tasks.filter((t: any) => t.status === "in_progress").length}
                </h3>
                <p>In Progress</p>
              </div>
              <div className="stat-card">
                <h3>
                  {tasks.filter((t: any) => t.status === "completed").length}
                </h3>
                <p>Completed</p>
              </div>
            </div>

            {/* Design Assignments List */}
            <div className="card" style={{ marginTop: "24px" }}>
              <h3>My Design Assignments</h3>
              {loading ? (
                <p
                  style={{ color: "var(--text-secondary)", marginTop: "16px" }}
                >
                  Loading design assignments...
                </p>
              ) : tasks.length > 0 ? (
                <table className="table" style={{ marginTop: "16px" }}>
                  <thead>
                    <tr>
                      <th>Task Title</th>
                      <th>Hoarding Code</th>
                      <th>Client</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task: any) => (
                      <tr key={task.id}>
                        <td>{task.title}</td>
                        <td>{task.hoardingCode || "N/A"}</td>
                        <td>{task.clientName || "N/A"}</td>
                        <td>
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              task.status === "completed"
                                ? "badge-success"
                                : task.status === "in_progress"
                                  ? "badge-warning"
                                  : "badge-info"
                            }`}
                          >
                            {task.status || "Pending"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-primary"
                            style={{ padding: "5px 10px", fontSize: "12px" }}
                            onClick={() =>
                              router.push(`/booking-tokens/${task.tokenId}`)
                            }
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    🎨
                  </div>
                  <p style={{ marginTop: "16px" }}>
                    No design assignments at the moment.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions for Designer */}
            <div className="card" style={{ marginTop: "24px" }}>
              <h3>Quick Actions</h3>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/tasks")}
                >
                  View All Design Tasks
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/notifications")}
                >
                  View Notifications
                </button>
              </div>
            </div>
          </>
        )}

        {/* Fitter Dashboard - Assigned Jobs Only */}
        {userRoleLower === "fitter" && (
          <>
            <div className="grid">
              <div className="stat-card">
                <h3>
                  {tasks.filter((t: any) => t.status === "pending").length}
                </h3>
                <p>Pending Installations</p>
              </div>
              <div className="stat-card">
                <h3>
                  {tasks.filter((t: any) => t.status === "in_progress").length}
                </h3>
                <p>In Progress</p>
              </div>
              <div className="stat-card">
                <h3>
                  {tasks.filter((t: any) => t.status === "completed").length}
                </h3>
                <p>Fitted</p>
              </div>
            </div>

            {/* Assigned Installation Jobs */}
            <div className="card" style={{ marginTop: "24px" }}>
              <h3>My Assigned Installation Jobs</h3>
              {loading ? (
                <LoadingAnimation label="Loading installation jobs..." />
              ) : tasks.length > 0 ? (
                <table className="table" style={{ marginTop: "16px" }}>
                  <thead>
                    <tr>
                      <th>Job Title</th>
                      <th>Hoarding Code</th>
                      <th>Location</th>
                      <th>Client</th>
                      <th>Assigned Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task: any) => (
                      <tr key={task.id}>
                        <td>{task.title}</td>
                        <td>{task.hoardingCode || "N/A"}</td>
                        <td>{task.location || "N/A"}</td>
                        <td>{task.clientName || "N/A"}</td>
                        <td>
                          {task.assignedDate
                            ? new Date(task.assignedDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <select
                              className="input"
                              value={
                                fitterStatusDraftByTokenId[
                                  String(task.tokenId)
                                ] || normalizedFitterStatus(task.status)
                              }
                              disabled={
                                !!savingFitterByTokenId[String(task.tokenId)]
                              }
                              onChange={(e) =>
                                setFitterStatusDraftByTokenId((prev) => ({
                                  ...(prev || {}),
                                  [String(task.tokenId)]:
                                    normalizedFitterStatus(e.target.value),
                                }))
                              }
                            >
                              <option value="pending">Pending</option>
                              <option
                                value="in_progress"
                                disabled={
                                  normalizedFitterStatus(task.status) !==
                                  "pending"
                                }
                              >
                                In Progress
                              </option>
                              <option
                                value="fitted"
                                disabled={
                                  normalizedFitterStatus(task.status) !==
                                  "in_progress"
                                }
                              >
                                Fitted
                              </option>
                            </select>

                            {(fitterStatusDraftByTokenId[
                              String(task.tokenId)
                            ] || normalizedFitterStatus(task.status)) ===
                              "fitted" && (
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={
                                  !!savingFitterByTokenId[String(task.tokenId)]
                                }
                                onChange={(e) => {
                                  const list = Array.from(e.target.files || []);
                                  setFitterProofFilesByTokenId((prev) => ({
                                    ...(prev || {}),
                                    [String(task.tokenId)]: list,
                                  }));
                                }}
                              />
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn btn-primary"
                            style={{ padding: "5px 10px", fontSize: "12px" }}
                            disabled={
                              !!savingFitterByTokenId[String(task.tokenId)]
                            }
                            onClick={() =>
                              handleSaveFitterRow(
                                String(task.tokenId),
                                task.status,
                              )
                            }
                          >
                            Submit
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{
                              padding: "5px 10px",
                              fontSize: "12px",
                              marginLeft: 8,
                            }}
                            onClick={() =>
                              router.push(`/booking-tokens/${task.tokenId}`)
                            }
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    🔧
                  </div>
                  <p style={{ marginTop: "16px" }}>
                    No installation jobs assigned at the moment.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions for Fitter */}
            <div className="card" style={{ marginTop: "24px" }}>
              <h3>Quick Actions</h3>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/tasks")}
                >
                  View All Jobs
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/location")}
                >
                  Track Location
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/notifications")}
                >
                  View Notifications
                </button>
              </div>
            </div>
          </>
        )}

        {/* Supervisor Dashboard – Assign execution type & designer */}
        {userRoleLower === "supervisor" && (
          <>
            <div className="card supervisor-assignment-card">
              <div className="supervisor-assignment-header">
                <div>
                  <h3 style={{ marginBottom: "6px" }}>
                    Booked Hoardings — Assign Execution &amp; Designer
                  </h3>
                  <p className="supervisor-assignment-subtitle">
                    Assign execution type and designer from each client row,
                    then open a client to manage hoardings one by one.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/dashboard/supervisor")}
                >
                  Go to Execution Board
                </button>
              </div>

              {loading ? (
                <LoadingAnimation label="Loading hoardings..." />
              ) : supervisorHoardings.length > 0 ? (
                <div className="supervisor-client-section">
                  <div className="supervisor-assignment-table-wrap">
                    <table className="table supervisor-assignment-table supervisor-client-table">
                      <thead>
                        <tr>
                          <th>Client Name</th>
                          <th>Client Phone</th>
                          <th>Booked Hoardings</th>
                          <th>Unlocked</th>
                          <th>Execution Type</th>
                          <th>Designer</th>
                          <th>Assign</th>
                          <th>Expand / View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supervisorClientGroups.map((group) => {
                          const unlockedCount = group.rows.filter(
                            (h: any) => !isSupervisorAssignmentLocked(h),
                          ).length;
                          const clientExec = clientExecDraft[group.key] || "";
                          const clientRequiresDesigner =
                            !!clientExec &&
                            clientExec !== "CLIENT_DIRECT_FLEX";
                          const clientDesigner =
                            clientDesignerDraft[group.key] || "";
                          const clientSaving = assigningClientKey === group.key;
                          const isViewing =
                            selectedSupervisorClient === group.key;
                          return (
                            <Fragment key={group.key}>
                              <tr
                                className={
                                  isViewing
                                    ? "supervisor-client-row-active"
                                    : undefined
                                }
                              >
                                <td>
                                  <div className="supervisor-hoarding-code">
                                    {group.name}
                                  </div>
                                </td>
                                <td className="supervisor-text-cell">
                                  {group.phone || "-"}
                                </td>
                                <td className="supervisor-text-cell">
                                  {group.rows.length}
                                </td>
                                <td className="supervisor-text-cell">
                                  {unlockedCount}
                                </td>
                                <td className="supervisor-client-control-cell">
                                  <CustomSelect
                                    value={clientExec}
                                    onChange={(value) => {
                                      setClientExecDraft((prev) => ({
                                        ...prev,
                                        [group.key]: value,
                                      }));
                                      if (value === "CLIENT_DIRECT_FLEX") {
                                        setClientDesignerDraft((prev) => {
                                          const next = { ...(prev || {}) };
                                          delete next[group.key];
                                          return next;
                                        });
                                      }
                                    }}
                                    options={executionTypeOptions}
                                    placeholder="Select..."
                                    className="supervisor-custom-select"
                                    disabled={clientSaving || unlockedCount === 0}
                                  />
                                </td>
                                <td className="supervisor-client-control-cell">
                                  <CustomSelect
                                    value={clientDesigner}
                                    onChange={(value) =>
                                      setClientDesignerDraft((prev) => ({
                                        ...prev,
                                        [group.key]: value,
                                      }))
                                    }
                                    options={designerOptions}
                                    placeholder={
                                      clientRequiresDesigner
                                        ? "Select designer..."
                                        : clientExec === "CLIENT_DIRECT_FLEX"
                                          ? "Not needed"
                                          : "Select execution first"
                                    }
                                    className="supervisor-custom-select"
                                    disabled={
                                      clientSaving ||
                                      unlockedCount === 0 ||
                                      !clientRequiresDesigner
                                    }
                                  />
                                </td>
                                <td>
                                  <button
                                    className="btn btn-primary supervisor-assign-btn"
                                    disabled={
                                      clientSaving ||
                                      unlockedCount === 0 ||
                                      !clientExec ||
                                      (clientRequiresDesigner && !clientDesigner)
                                    }
                                    onClick={() =>
                                      handleAssignClientHoardings(group.key)
                                    }
                                    title={`${unlockedCount} unlocked hoarding(s) can be assigned`}
                                  >
                                    {clientSaving ? "Assigning..." : "Assign"}
                                  </button>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-primary supervisor-assign-btn"
                                    onClick={() =>
                                      setSelectedSupervisorClient(
                                        isViewing ? "all" : group.key,
                                      )
                                    }
                                  >
                                    {isViewing ? "Hide" : "View"}
                                  </button>
                                </td>
                              </tr>
                              {isViewing ? (
                                <tr className="supervisor-inline-detail-row">
                                  <td colSpan={8}>
                                    <div className="supervisor-selected-client-card supervisor-inline-detail-card">
                                      <div className="supervisor-selected-client-header">
                                        <div>
                                          <h4>{group.name}</h4>
                                          <p>
                                            {group.phone || "No phone"} -{" "}
                                            {group.rows.length} booked hoarding(s)
                                          </p>
                                        </div>
                                      </div>
                                      <div className="supervisor-assignment-table-wrap">
                                        <table className="table supervisor-assignment-table">
                                          <thead>
                                            <tr>
                                              <th>Hoarding</th>
                                              <th>Status</th>
                                              <th>Design Status</th>
                                              <th>Current Execution</th>
                                              <th>New Execution</th>
                                              <th>Designer</th>
                                              <th>Action</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {renderSupervisorHoardingRows(
                                              group.rows,
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="supervisor-empty">
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    📋
                  </div>
                  <p>No booked hoardings to assign right now.</p>
                </div>
              )}
            </div>

            {/* Quick Actions for Supervisor */}
            <div className="card" style={{ marginTop: "24px" }}>
              <h3>Quick Actions</h3>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/dashboard/supervisor")}
                >
                  Execution Board
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/hoardings")}
                >
                  View Hoardings
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/notifications")}
                >
                  View Notifications
                </button>
              </div>
            </div>
          </>
        )}

        {/* Fallback for unknown roles */}
        {!loading &&
          !canViewRentInfo &&
          userRoleLower !== "sales" &&
          userRoleLower !== "designer" &&
          userRoleLower !== "fitter" &&
          userRoleLower !== "supervisor" && (
            <div className="card">
              <h3>Welcome to Dashboard</h3>
              <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
                Your role-specific dashboard content will appear here.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/hoardings")}
                >
                  View Hoardings
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/notifications")}
                >
                  View Notifications
                </button>
              </div>
            </div>
          )}
      </div>
      <style jsx>{`
        .loading-value {
          display: inline-block;
          min-width: 24px;
          letter-spacing: 2px;
          color: var(--brand-blue);
          font-weight: 800;
        }

        .supervisor-assignment-card {
          padding: 24px;
        }

        .supervisor-assignment-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }

        .supervisor-assignment-subtitle {
          margin: 0;
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.4;
        }

        .supervisor-client-section {
          margin-top: 20px;
        }

        .supervisor-client-toolbar {
          display: grid;
          grid-template-columns: minmax(240px, 1.25fr) minmax(190px, 1fr) minmax(
              190px,
              1fr
            ) auto;
          align-items: end;
          gap: 14px;
          padding: 16px;
          border: 1px solid color-mix(in srgb, var(--border-color) 60%, white);
          border-radius: var(--radius-lg);
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--primary-color) 9%, white),
            #fff 62%
          );
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
        }

        .supervisor-toolbar-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        .supervisor-toolbar-field label {
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .supervisor-client-assign-btn {
          min-height: 40px;
          min-width: 150px;
          padding: 10px 16px;
          white-space: nowrap;
        }

        .supervisor-disabled-value {
          display: flex;
          align-items: center;
          min-height: 40px;
          padding: 0 12px;
          border: 1px solid color-mix(in srgb, var(--border-color) 65%, white);
          border-radius: var(--radius-sm);
          background: color-mix(in srgb, var(--bg-secondary) 70%, white);
          color: var(--text-secondary);
          font-size: 14px;
        }

        .supervisor-selected-client-card {
          margin-top: 18px;
          padding: 16px;
          border: 1px solid color-mix(in srgb, var(--border-color) 58%, white);
          border-radius: var(--radius-lg);
          background: #fff;
        }

        .supervisor-selected-client-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .supervisor-selected-client-header h4 {
          margin: 0;
          color: var(--text-primary);
          font-size: 18px;
          font-weight: 800;
        }

        .supervisor-selected-client-header p {
          margin: 4px 0 0;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .supervisor-assignment-table-wrap {
          margin-top: 18px;
          overflow-x: auto;
          border-radius: var(--radius-lg);
          border: 1px solid color-mix(in srgb, var(--border-color) 55%, white);
        }

        :global(.supervisor-assignment-table) {
          margin-top: 0;
          box-shadow: none;
          border-radius: 0;
        }

        :global(.supervisor-assignment-table th),
        :global(.supervisor-assignment-table td) {
          padding: 14px 12px;
          vertical-align: middle;
        }

        :global(.supervisor-assignment-table th) {
          font-size: 12px;
          letter-spacing: 0.4px;
          white-space: nowrap;
        }

        .supervisor-hoarding-code {
          font-weight: 700;
          font-size: 15px;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .supervisor-hoarding-location {
          margin-top: 4px;
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.3;
          max-width: 280px;
        }

        .supervisor-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .status-pill {
          background: color-mix(in srgb, var(--primary-color) 16%, white);
          color: var(--brand-blue);
          border-color: color-mix(in srgb, var(--brand-blue) 28%, white);
        }

        .design-pill {
          background: color-mix(in srgb, var(--amber-yellow) 20%, white);
          color: var(--text-primary);
          border-color: color-mix(in srgb, var(--brand-yellow) 36%, white);
        }

        .supervisor-text-cell {
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 600;
          min-width: 140px;
          text-transform: capitalize;
        }

        .supervisor-client-control-cell {
          min-width: 210px;
        }

        .supervisor-client-table :global(td .supervisor-custom-select) {
          min-width: 170px;
        }

        :global(.supervisor-client-table tbody tr.supervisor-client-row-active) {
          background: color-mix(in srgb, var(--primary-color) 10%, white);
        }

        :global(
            .supervisor-client-table tbody tr.supervisor-client-row-active td
          ) {
          box-shadow: inset 0 -1px 0
            color-mix(in srgb, var(--primary-color) 18%, white);
        }

        :global(.supervisor-client-table tbody tr.supervisor-inline-detail-row) {
          background: transparent;
        }

        :global(
            .supervisor-client-table tbody tr.supervisor-inline-detail-row td
          ) {
          padding: 0;
          border: 0;
        }

        .supervisor-inline-detail-card {
          margin: 0;
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
          border-top: 0;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--primary-color) 6%, white),
            #fff 26%
          );
        }

        .supervisor-select {
          width: 100%;
          min-width: 180px;
          padding: 8px 10px;
          border: 1px solid color-mix(in srgb, var(--border-color) 65%, white);
          border-radius: var(--radius-sm);
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 13px;
          line-height: 1.35;
        }

        .supervisor-select:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px
            color-mix(in srgb, var(--primary-color) 20%, transparent);
        }

        .supervisor-custom-select {
          min-width: 180px;
        }

        .supervisor-client-toolbar .supervisor-custom-select {
          min-width: 0;
        }

        .supervisor-muted {
          color: var(--text-secondary);
          font-size: 13px;
        }

        .supervisor-assign-btn {
          min-width: 96px;
          padding: 9px 14px;
          font-size: 13px;
        }

        .supervisor-empty {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
        }

        :global(.supervisor-assignment-table tbody tr:hover) {
          transform: none;
          background: color-mix(in srgb, var(--primary-color) 8%, white);
        }

        @media (max-width: 1024px) {
          .supervisor-assignment-card {
            padding: 20px;
          }

          .supervisor-client-toolbar {
            grid-template-columns: repeat(2, minmax(220px, 1fr));
          }

          .supervisor-client-assign-btn {
            width: 100%;
          }

          .supervisor-select {
            min-width: 160px;
          }
        }

        @media (max-width: 640px) {
          .supervisor-assignment-card {
            padding: 16px;
          }

          .supervisor-assignment-header {
            align-items: stretch;
          }

          .supervisor-assignment-header :global(.btn) {
            width: 100%;
          }

          .supervisor-client-toolbar {
            grid-template-columns: 1fr;
            padding: 14px;
          }

          .supervisor-select {
            min-width: 140px;
          }

          :global(.supervisor-assignment-table th),
          :global(.supervisor-assignment-table td) {
            padding: 12px 10px;
          }
        }
      `}</style>
    </>
  );
}

export default function Dashboard() {
  return <DashboardContent />;
}
