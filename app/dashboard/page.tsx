"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import {
  dashboardAPI,
  remindersAPI,
  notificationsAPI,
  hoardingsAPI,
  bookingsAPI,
  enquiriesAPI,
  bookingTokensAPI,
  proposalsAPI,
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

  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    const roleLower = String(user?.role || "").toLowerCase();
    if (roleLower === "supervisor") {
      router.replace("/dashboard/supervisor");
    }
  }, [user, router]);

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
          const [hoardingsRes, bookingsRes, enquiriesRes, proposalsRes] =
            await Promise.allSettled([
              hoardingsAPI.getAll({ page: 1, limit: 1000 }),
              bookingsAPI.getAll().catch(() => ({ data: [] })),
              enquiriesAPI.getAll().catch(() => ({ data: [] })),
              proposalsAPI.list().catch(() => ({ success: true, data: [] })),
            ]);

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

          const totalHoardings = hoardingsData.data?.total || 0;
          const availableHoardings =
            hoardingsData.data?.hoardings?.filter(
              (h: any) => h.status === "available",
            ).length || 0;
          const bookings = bookingsData.data?.data || bookingsData.data || [];
          const enquiries =
            enquiriesData.data?.data || enquiriesData.data || [];

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
            totalBookings: bookings.length,
            totalEnquiries: enquiries.length,
            pendingEnquiries: enquiries.filter(
              (e: any) => e.status === "pending" || e.status === "new",
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
    if (!confirm("Send rent reminders for hoardings due in the next 7 days?")) {
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

  // Don't show loading spinner - show content immediately with empty states if needed

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

        {/* Rent Overview Cards - Only for Owner/Manager */}
        {canViewRentInfo && (
          <>
            <div className="grid">
              {stats?.mode === "property" ? (
                <>
                  <div className="stat-card">
                    <h3>{stats?.totalProperties || 0}</h3>
                    <p>Total Properties on Rent</p>
                  </div>
                  <div className="stat-card">
                    <h3>
                      ₹
                      {Number(
                        stats?.totalMonthlyRentLoad || 0,
                      ).toLocaleString()}
                    </h3>
                    <p>Total Monthly Rent Load</p>
                  </div>
                  <div className="stat-card">
                    <h3>
                      ₹
                      {Number(stats?.totalAnnualizedRent || 0).toLocaleString()}
                    </h3>
                    <p>Annualized Rent</p>
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
                    <p>Total Hoardings on Rent</p>
                  </div>
                  <div className="stat-card">
                    <h3>
                      ₹{Number(stats?.totalRentAmount || 0).toLocaleString()}
                    </h3>
                    <p>Total Rent Amount</p>
                  </div>
                  <div className="stat-card">
                    <h3>
                      ₹
                      {Number(stats?.totalAnnualizedRent || 0).toLocaleString()}
                    </h3>
                    <p>Annualized Rent</p>
                  </div>
                  <div className="stat-card">
                    <h3>{upcomingDues.length}</h3>
                    <p>Upcoming Rent Dues</p>
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
                    Send email reminders for hoardings with rent due in the next
                    7 days
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
                <h3>Upcoming Rent Due</h3>
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
                  Loading rent dues...
                </p>
              </div>
            ) : upcomingDues.length > 0 ? (
              <div className="card">
                <h3>Upcoming Rent Due (Next 5)</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hoarding Code</th>
                      <th>Location</th>
                      <th>Party Type</th>
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
                            <strong>{rent.hoarding?.code || "N/A"}</strong>
                          </td>
                          <td>
                            {rent.hoarding?.city || ""}
                            {rent.hoarding?.area && `, ${rent.hoarding.area}`}
                          </td>
                          <td>
                            <span className="badge badge-info">
                              {rent.partyType}
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
                            <button
                              className="btn btn-primary"
                              style={{ padding: "5px 10px", fontSize: "12px" }}
                              onClick={() =>
                                router.push(
                                  `/hoardings/${rent.hoardingId}/rent`,
                                )
                              }
                            >
                              View Rent
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card">
                <h3>Upcoming Rent Due</h3>
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
                    No upcoming rent dues at the moment.
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
                <h3>{salesStats?.totalHoardings || 0}</h3>
                <p>Total Hoardings</p>
              </div>
              <div className="stat-card">
                <h3>{salesStats?.availableHoardings || 0}</h3>
                <p>Available Hoardings</p>
              </div>
              <div className="stat-card">
                <h3>{salesStats?.totalBookings || 0}</h3>
                <p>Total Bookings</p>
              </div>
              <div className="stat-card">
                <h3>{salesStats?.totalEnquiries || 0}</h3>
                <p>Total Enquiries</p>
              </div>
              <div className="stat-card">
                <h3>{salesStats?.pendingEnquiries || 0}</h3>
                <p>Pending Enquiries</p>
              </div>
            </div>

            {/* Recent Bookings */}
            {loading ? (
              <div className="card" style={{ marginTop: "24px" }}>
                <h3>Recent Bookings</h3>
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
                  Loading bookings...
                </p>
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
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
                  Loading enquiries...
                </p>
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
                <p
                  style={{ color: "var(--text-secondary)", marginTop: "16px" }}
                >
                  Loading installation jobs...
                </p>
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

        {/* Fallback for unknown roles */}
        {!loading &&
          !canViewRentInfo &&
          userRoleLower !== "sales" &&
          userRoleLower !== "designer" &&
          userRoleLower !== "fitter" && (
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
    </>
  );
}

export default function Dashboard() {
  return <DashboardContent />;
}
