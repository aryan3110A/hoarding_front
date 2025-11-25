"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout, { useUser } from "@/components/AppLayout";
import {
  dashboardAPI,
  remindersAPI,
  notificationsAPI,
  hoardingsAPI,
  bookingsAPI,
  enquiriesAPI,
  tasksAPI,
  designAssignmentsAPI,
} from "@/lib/api";
import { canViewRent, canAssignTasks } from "@/lib/rbac";

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [upcomingDues, setUpcomingDues] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sendingReminders, setSendingReminders] = useState(false);

  // Sales-specific data
  const [salesStats, setSalesStats] = useState<any>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [recentEnquiries, setRecentEnquiries] = useState<any[]>([]);

  // Designer/Fitter-specific data
  const [tasks, setTasks] = useState<any[]>([]);

  const user = useUser();
  const router = useRouter();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const userRole = user?.role?.toLowerCase() || "";

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
              response
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
          const [hoardingsRes, bookingsRes, enquiriesRes] =
            await Promise.allSettled([
              hoardingsAPI.getAll({ page: 1, limit: 1000 }),
              bookingsAPI.getAll().catch(() => ({ data: [] })),
              enquiriesAPI.getAll().catch(() => ({ data: [] })),
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

          const totalHoardings = hoardingsData.data?.total || 0;
          const availableHoardings =
            hoardingsData.data?.hoardings?.filter(
              (h: any) => h.status === "available"
            ).length || 0;
          const bookings = bookingsData.data?.data || bookingsData.data || [];
          const enquiries =
            enquiriesData.data?.data || enquiriesData.data || [];

          // Get recent bookings (last 5)
          const recent = bookings
            .sort(
              (a: any, b: any) =>
                new Date(b.createdAt || b.startDate || 0).getTime() -
                new Date(a.createdAt || a.startDate || 0).getTime()
            )
            .slice(0, 5);

          // Get recent enquiries (last 5)
          const recentEnq = enquiries
            .sort(
              (a: any, b: any) =>
                new Date(b.createdAt || b.created_at || 0).getTime() -
                new Date(a.createdAt || a.created_at || 0).getTime()
            )
            .slice(0, 5);

          setSalesStats({
            totalHoardings,
            availableHoardings,
            totalBookings: bookings.length,
            totalEnquiries: enquiries.length,
            pendingEnquiries: enquiries.filter(
              (e: any) => e.status === "pending" || e.status === "new"
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
        }
      }
      // Designer: Fetch design tasks
      else if (userRole === "designer") {
        try {
          const response = await tasksAPI.getAll({
            assignedTo: user?.id,
            type: "design",
          });
          if (response.success && response.data) {
            const designTasks = Array.isArray(response.data)
              ? response.data
              : response.data.tasks || [];
            setTasks(designTasks);
          } else {
            // Fallback: try design assignments API
            try {
              const designResponse = await designAssignmentsAPI.getAll({
                designerId: user?.id,
              });
              if (designResponse.success && designResponse.data) {
                const assignments = Array.isArray(designResponse.data)
                  ? designResponse.data
                  : designResponse.data.assignments || [];
                setTasks(
                  assignments.map((a: any) => ({
                    id: a.id,
                    title: `Design for ${a.hoarding?.code || "Hoarding"}`,
                    status: a.status?.toLowerCase() || "pending",
                    hoardingCode: a.hoarding?.code || a.hoardingId,
                    clientName: a.clientName,
                    dueDate: a.dueDate,
                  }))
                );
              }
            } catch (err) {
              console.error("Failed to fetch design assignments:", err);
              setTasks([]);
            }
          }
        } catch (error) {
          console.error("Failed to fetch design tasks:", error);
          setTasks([]);
        }
      }
      // Fitter: Fetch assigned installation jobs
      else if (userRole === "fitter") {
        try {
          const response = await tasksAPI.getAll({
            assignedTo: user?.id,
            type: "installation",
          });
          if (response.success && response.data) {
            const installationTasks = Array.isArray(response.data)
              ? response.data
              : response.data.tasks || [];
            setTasks(installationTasks);
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
          } emails sent.`
        );
        fetchDashboardData();
        fetchUnreadCount();
      } else {
        alert(
          "Failed to send reminders: " + (response.message || "Unknown error")
        );
      }
    } catch (error: any) {
      alert(
        "Error sending reminders: " +
          (error.response?.data?.message || "Unknown error")
      );
    } finally {
      setSendingReminders(false);
    }
  };

  const userRole = user?.role || "";
  const userRoleLower = userRole?.toLowerCase() || "";
  const canViewRentInfo = canViewRent(userRole);

  // Debug: Log user object to see what we're working with
  useEffect(() => {
    if (user) {
      console.log("Dashboard - User object:", user);
      console.log("Dashboard - User role:", userRole);
      console.log("Dashboard - Can view rent:", canViewRent);
      fetchDashboardData();
      fetchUnreadCount();
    } else {
      // If no user, stop loading
      setLoading(false);
    }
  }, [user]);

  // Don't show loading spinner - show content immediately with empty states if needed

  return (
    <AppLayout>
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
              <h1>Dashboard</h1>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "16px",
                  marginTop: "8px",
                }}
              >
                Welcome back, <strong>{user?.name || "User"}</strong>! Here's
                your overview.
              </p>
            </div>
            {user && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 20px",
                  background:
                    "linear-gradient(135deg, var(--primary-color), var(--primary-light))",
                  borderRadius: "12px",
                  color: "white",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    fontWeight: "bold",
                  }}
                >
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "16px" }}>
                    {user.name || "User"}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      opacity: 0.9,
                      textTransform: "capitalize",
                    }}
                  >
                    {user.role || "User"} Role
                  </div>
                </div>
              </div>
            )}
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
              <div className="stat-card">
                <h3>{stats?.totalHoardingsOnRent || 0}</h3>
                <p>Total Hoardings on Rent</p>
              </div>
              <div className="stat-card">
                <h3>₹{Number(stats?.totalRentAmount || 0).toLocaleString()}</h3>
                <p>Total Rent Amount</p>
              </div>
              <div className="stat-card">
                <h3>
                  ₹{Number(stats?.totalAnnualizedRent || 0).toLocaleString()}
                </h3>
                <p>Annualized Rent</p>
              </div>
              <div className="stat-card">
                <h3>{upcomingDues.length}</h3>
                <p>Upcoming Rent Dues</p>
              </div>
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
                              (1000 * 60 * 60 * 24)
                          )
                        : null;
                      const isUrgent =
                        daysUntilDue !== null &&
                        daysUntilDue <= 7 &&
                        daysUntilDue >= 0;

                      return (
                        <tr
                          key={rent.id}
                          style={isUrgent ? { backgroundColor: "#fff3cd" } : {}}
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
                                  isUrgent ? "badge-warning" : "badge-info"
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
                                  `/hoardings/${rent.hoardingId}/rent`
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
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
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
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
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
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
                  <p style={{ marginTop: "8px" }}>No enquiries yet.</p>
                </div>
              </div>
            )}

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
                <p style={{ color: "var(--text-secondary)", marginTop: "16px" }}>
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
                            onClick={() => router.push("/tasks")}
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
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎨</div>
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
                <p>Completed</p>
              </div>
            </div>

            {/* Assigned Installation Jobs */}
            <div className="card" style={{ marginTop: "24px" }}>
              <h3>My Assigned Installation Jobs</h3>
              {loading ? (
                <p style={{ color: "var(--text-secondary)", marginTop: "16px" }}>
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
                            onClick={() => router.push("/tasks")}
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
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔧</div>
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
        {!canViewRentInfo &&
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
    </AppLayout>
  );
}
