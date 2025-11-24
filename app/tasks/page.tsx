"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import AppLayout, { useUser } from "@/components/AppLayout";

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUser();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignedTo: "",
    dueDate: "",
    hoardingId: "",
    enquiryId: "",
    clientId: "",
  });
  const router = useRouter();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem("token");
      const [tasksRes, usersRes] = await Promise.allSettled([
        axios
          .get(
            `${
              process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
            }/api/tasks`,
            {
              headers: { Authorization: `Bearer ${authToken}` },
            }
          )
          .catch(() => ({ data: [] })),
        axios
          .get(
            `${
              process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
            }/api/users`,
            {
              headers: { Authorization: `Bearer ${authToken}` },
            }
          )
          .catch(() => ({ data: [] })),
      ]);
      const tasksData =
        tasksRes.status === "fulfilled" ? tasksRes.value.data || [] : [];
      const usersData =
        usersRes.status === "fulfilled" ? usersRes.value.data || [] : [];

      // Filter tasks based on role
      let filteredTasks = Array.isArray(tasksData) ? tasksData : [];
      const userRole = user?.role?.toLowerCase() || "";

      // Fitter/Execution role: Only see tasks assigned to them (installation jobs)
      if (userRole === "fitter" || userRole === "execution") {
        filteredTasks = filteredTasks.filter(
          (task: any) =>
            task.assignedTo === user?.id || task.assignedToId === user?.id
        );
      }

      // Designer role: Only see design-related tasks assigned to them
      if (userRole === "designer") {
        filteredTasks = filteredTasks.filter(
          (task: any) =>
            (task.assignedTo === user?.id || task.assignedToId === user?.id) &&
            (task.type === "design" ||
              task.title?.toLowerCase().includes("design") ||
              task.description?.toLowerCase().includes("design"))
        );
      }

      setTasks(filteredTasks);

      // Only Owner/Admin/Manager can see users list for assignment
      if (
        userRole === "admin" ||
        userRole === "owner" ||
        userRole === "manager"
      ) {
        setUsers(Array.isArray(usersData) ? usersData : []);
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setTasks([]);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const authToken = localStorage.getItem("token");
      await axios.post(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/tasks`,
        formData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      setShowForm(false);
      setFormData({
        title: "",
        description: "",
        assignedTo: "",
        dueDate: "",
        hoardingId: "",
        enquiryId: "",
        clientId: "",
      });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to create task");
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const authToken = localStorage.getItem("token");
      await axios.put(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/tasks/${id}`,
        { status },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to update task");
    }
  };

  const getUserName = (id: string) => {
    const foundUser = users.find((u) => u.id === id);
    return foundUser ? foundUser.name : id;
  };

  const getStatusColor = (status: string, dueDate: string) => {
    if (status === "Completed") return "#28a745";
    if (status === "Overdue") return "#dc3545";
    if (new Date(dueDate) < new Date() && status !== "Completed")
      return "#ffc107";
    return "#0070f3";
  };

  if (!user) {
    return (
      <AppLayout>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Loading...</p>
        </div>
      </AppLayout>
    );
  }

  const userRole = user?.role?.toLowerCase() || "";
  const isAdmin = userRole === "admin" || userRole === "owner";
  const isManager = userRole === "manager";
  const canCreateTasks = isAdmin || isManager; // Only Owner/Admin/Manager can create tasks

  return (
    <AppLayout>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h1>
            {userRole === "fitter" || userRole === "execution"
              ? "My Assigned Jobs"
              : "Tasks"}
          </h1>
          {canCreateTasks && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn btn-primary"
            >
              {showForm ? "Cancel" : "Create Task"}
            </button>
          )}
        </div>

        {showForm && canCreateTasks && (
          <div className="card">
            <h3>Create New Task</h3>
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "15px",
                }}
              >
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Assign To *</label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) =>
                      setFormData({ ...formData, assignedTo: e.target.value })
                    }
                    required
                  >
                    <option value="">Select User</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>Due Date *</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Related Hoarding ID</label>
                  <input
                    type="text"
                    value={formData.hoardingId}
                    onChange={(e) =>
                      setFormData({ ...formData, hoardingId: e.target.value })
                    }
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Create Task
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <h3>All Tasks</h3>
          {tasks.length > 0 ? (
            <table className="table" style={{ marginTop: "16px" }}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Assigned To</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    style={{
                      backgroundColor:
                        new Date(task.dueDate) < new Date() &&
                        task.status !== "Completed"
                          ? "#fff3cd"
                          : "white",
                    }}
                  >
                    <td>{task.title}</td>
                    <td>{getUserName(task.assignedTo)}</td>
                    <td>{new Date(task.dueDate).toLocaleDateString()}</td>
                    <td>
                      <span
                        style={{
                          color: getStatusColor(task.status, task.dueDate),
                          fontWeight: "bold",
                        }}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td>
                      <select
                        value={task.status}
                        onChange={(e) =>
                          handleUpdateStatus(task.id, e.target.value)
                        }
                        style={{ padding: "5px", fontSize: "12px" }}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
              <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>
                {userRole === "fitter" || userRole === "execution"
                  ? "No Assigned Jobs Yet"
                  : "No Tasks Yet"}
              </h3>
              <p style={{ marginBottom: "24px" }}>
                {userRole === "fitter" || userRole === "execution"
                  ? "You don't have any assigned hoarding installation jobs at the moment."
                  : "Create your first task to start tracking work assignments."}
              </p>
              {canCreateTasks && (
                <button
                  onClick={() => setShowForm(true)}
                  className="btn btn-primary"
                >
                  Create Task
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
