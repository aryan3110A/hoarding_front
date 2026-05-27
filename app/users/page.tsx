"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";
import { usersAPI, rolesAPI } from "@/lib/api";
import { showSuccess, showError } from "@/lib/toast";

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [salesDeviceStatus, setSalesDeviceStatus] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesDeviceLoading, setSalesDeviceLoading] = useState(false);
  const userFromContext = useUser();
  const [user, setUser] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    password: "",
    name: "",
    roleId: "",
    territory: "",
  });
  const router = useRouter();

  useEffect(() => {
    if (userFromContext) {
      setUser(userFromContext);
    } else {
      const localUser = localStorage.getItem("user");
      if (localUser) {
        try {
          setUser(JSON.parse(localUser));
        } catch (error) {
          console.error("Failed to parse user from localStorage:", error);
        }
      }
    }
  }, [userFromContext]);

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchRoles();
      fetchSalesDeviceStatus();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const intervalId = window.setInterval(() => {
      fetchSalesDeviceStatus();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      console.log("Users API response:", response);
      if (response.success && Array.isArray(response.data)) {
        setUsers(response.data);
      } else if (
        response.success &&
        response.data &&
        Array.isArray(response.data.data)
      ) {
        // Handle paginated response structure if applicable
        setUsers(response.data.data);
      } else {
        console.warn("Unexpected users API response format:", response);
        setUsers([]);
      }
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await rolesAPI.getAll();
      if (response.success && response.data) {
        setRoles(response.data);
        // Set default role to first available role
        if (response.data.length > 0 && !formData.roleId) {
          setFormData({ ...formData, roleId: response.data[0].id.toString() });
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch roles:", error);
    }
  };

  const fetchSalesDeviceStatus = async () => {
    try {
      setSalesDeviceLoading(true);
      const response = await usersAPI.getSalesDeviceStatus();
      if (response.success && Array.isArray(response.data)) {
        setSalesDeviceStatus(response.data);
      } else {
        setSalesDeviceStatus([]);
      }
    } catch (error: any) {
      console.error("Failed to fetch sales device status:", error);
      setSalesDeviceStatus([]);
    } finally {
      setSalesDeviceLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        password: formData.password,
        roleId: parseInt(formData.roleId),
      };
      const response = await usersAPI.create(payload);
      if (response.success) {
        setShowForm(false);
        setFormData({
          email: "",
          phone: "",
          password: "",
          name: "",
          roleId: roles.length > 0 ? roles[0].id.toString() : "",
          territory: "",
        });
        fetchUsers();
        fetchSalesDeviceStatus();
        showSuccess("User created successfully!");
      }
    } catch (error: any) {
      const raw =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to create user";

      // Normalize common backend messages and provide actionable text
      const msg = String(raw)
        .replace(/\u001b\[[0-9;]*m/g, "")
        .trim();

      if (/email already exists/i.test(msg)) {
        showError(
          "A user with this email already exists — choose a different phone number or role.",
        );
      } else if (/phone already exists/i.test(msg)) {
        showError(
          "A user with this phone number already exists — choose a different phone number or role.",
        );
      } else if (
        /same name and role/i.test(msg) ||
        /same name and role already exists/i.test(msg) ||
        /same name and role and phone number already exists/i.test(msg)
      ) {
        showError(
          "A user with the same name and role already exists. Please choose a different role or phone number.",
        );
      } else {
        showError(msg || "Failed to create user");
      }
    }
  };

  const [editingUser, setEditingUser] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    phone: "",
    roleId: "",
    territory: "",
    isActive: true,
  });

  const handleEdit = (user: any) => {
    setEditingUser(user);
    // Find role ID from role name
    const role = roles.find(
      (r) => r.name.toLowerCase() === (user.role?.toLowerCase() || ""),
    );
    setEditFormData({
      name: user.name,
      email: user.email || "",
      phone: user.phone || "",
      roleId: role?.id.toString() || "",
      territory: user.territory || "",
      isActive: user.isActive,
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const payload: any = {
        name: editFormData.name,
        isActive: editFormData.isActive,
      };
      if (editFormData.email) payload.email = editFormData.email;
      if (editFormData.phone) payload.phone = editFormData.phone;
      if (editFormData.roleId) payload.roleId = parseInt(editFormData.roleId);

      const response = await usersAPI.update(editingUser.id, payload);
      if (response.success) {
        setEditingUser(null);
        fetchUsers();
        fetchSalesDeviceStatus();
        showSuccess("User updated successfully!");
      }
    } catch (error: any) {
      const raw =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to update user";
      showError(String(raw).replace(/\u001b\[[0-9;]*m/g, ""));
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete user "${userName}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      const response = await usersAPI.delete(userId);
      if (response.success) {
        fetchUsers();
        fetchSalesDeviceStatus();
        showSuccess("User deleted successfully!");
      }
    } catch (error: any) {
      const raw =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to delete user";
      showError(String(raw).replace(/\u001b\[[0-9;]*m/g, ""));
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      const response = await usersAPI.update(userId, { isActive: !isActive });
      if (response.success) {
        fetchUsers();
        fetchSalesDeviceStatus();
      }
    } catch (error: any) {
      const raw =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to update user";
      showError(String(raw).replace(/\u001b\[[0-9;]*m/g, ""));
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";

    return parsed.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCoordinate = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return value.toFixed(6);
  };

  const formatRelativeTime = (value?: string | null) => {
    if (!value) return "";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";

    const diffMs = Date.now() - parsed.getTime();
    if (diffMs < 0) return "just now";

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes <= 0) return "just now";
    if (diffMinutes === 1) return "1 minute ago";
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };

  const buildGoogleMapsUrl = (
    latitude?: number | null,
    longitude?: number | null,
  ) => {
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return null;
    }

    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const userRole = user?.role?.toLowerCase() || "";
  if (userRole !== "owner" && userRole !== "admin") {
    return <AccessDenied />;
  }

  const getRoleName = (roleId: number | string | null) => {
    if (!roleId) return "N/A";
    const role = roles.find((r) => r.id === parseInt(roleId.toString()));
    return role ? role.name : "N/A";
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1>User Management</h1>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => router.push("/roles")}
            className="btn btn-secondary"
          >
            Manage Roles
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-primary"
          >
            {showForm ? "Cancel" : "Add New User"}
          </button>
        </div>
      </div>

      {editingUser && (
        <div
          className="card"
          style={{
            marginBottom: "24px",
            border: "2px solid var(--primary-color)",
            background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
          }}
        >
          <h3 style={{ marginBottom: "20px", color: "var(--primary-color)" }}>
            ✏️ Edit User: {editingUser.name}
          </h3>
          <form onSubmit={handleUpdateUser}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "15px",
              }}
            >
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      email: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      phone: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select
                  value={editFormData.roleId}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      roleId: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Account Status</label>
                <select
                  value={editFormData.isActive ? "Active" : "Inactive"}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      isActive: e.target.value === "Active",
                    })
                  }
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button type="submit" className="btn btn-primary">
                💾 Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="btn btn-secondary"
              >
                ❌ Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h3>Create New User</h3>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "15px",
              }}
            >
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Email (optional if phone provided)"
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Phone (optional if email provided)"
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select
                  value={formData.roleId}
                  onChange={(e) =>
                    setFormData({ ...formData, roleId: e.target.value })
                  }
                  required
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: "20px" }}
            >
              Create User
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ marginBottom: "4px" }}>Sales Device Status</h3>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              See which sales user is currently logged in and on which device.
            </p>
          </div>
          <button
            onClick={fetchSalesDeviceStatus}
            className="btn btn-secondary"
            disabled={salesDeviceLoading}
          >
            {salesDeviceLoading ? "Refreshing..." : "Refresh Status"}
          </button>
        </div>

        {salesDeviceStatus.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Sales User</th>
                <th>Status</th>
                <th>Current Device</th>
                <th>Platform</th>
                <th>IP</th>
                <th>Coordinates</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {salesDeviceStatus.map((item) => (
                <tr key={item.userId}>
                  <td>
                    <strong>{item.name}</strong>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        marginTop: "4px",
                      }}
                    >
                      {item.email || item.phone || "-"}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        item.isLoggedIn ? "badge-success" : "badge-info"
                      }`}
                    >
                      {item.isLoggedIn ? "Logged In" : "Logged Out"}
                    </span>
                  </td>
                  <td>{item.currentDevice || "-"}</td>
                  <td>{item.platform || "-"}</td>
                  <td>{item.ip || "-"}</td>
                  <td>
                    {item.latitude != null && item.longitude != null
                      ? (() => {
                          const relativeTime = formatRelativeTime(
                            item.lastSeen,
                          );

                          return (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                              }}
                            >
                              <span>
                                {`${formatCoordinate(item.latitude)}, ${formatCoordinate(
                                  item.longitude,
                                )}`}
                              </span>
                              {relativeTime ? (
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  Last location updated {relativeTime}
                                </span>
                              ) : null}
                              <a
                                href={
                                  buildGoogleMapsUrl(
                                    item.latitude,
                                    item.longitude,
                                  ) || "#"
                                }
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: "var(--primary-color)",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  textDecoration: "none",
                                }}
                              >
                                Open in Google Maps
                              </a>
                            </div>
                          );
                        })()
                      : "-"}
                  </td>
                  <td>{formatDateTime(item.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "36px 20px",
              color: "var(--text-secondary)",
            }}
          >
            {salesDeviceLoading
              ? "Loading sales device status..."
              : "No sales users found yet."}
          </div>
        )}
      </div>

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h3>All Users ({users.length})</h3>
          {users.length > 0 && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {roles.map((role) => {
                const count = users.filter(
                  (u) => u.role?.toLowerCase() === role.name.toLowerCase(),
                ).length;
                if (count === 0) return null;
                return (
                  <span key={role.id} className="badge badge-info">
                    {count}{" "}
                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {users.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    {u.id === user?.id && (
                      <span
                        className="badge badge-info"
                        style={{ marginLeft: "8px", fontSize: "10px" }}
                      >
                        You
                      </span>
                    )}
                  </td>
                  <td>{u.email || "-"}</td>
                  <td>{u.phone || "-"}</td>
                  <td>
                    <span className="badge badge-info">
                      {u.role
                        ? u.role.charAt(0).toUpperCase() + u.role.slice(1)
                        : "N/A"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        u.isActive ? "badge-success" : "badge-danger"
                      }`}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
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
                        onClick={() => handleEdit(u)}
                        className="btn btn-primary"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(u.id, u.isActive)}
                        className={`btn ${
                          u.isActive ? "btn-danger" : "btn-success"
                        }`}
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                      >
                        {u.isActive ? "🚫 Disable" : "✅ Enable"}
                      </button>
                      {u.id !== user?.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="btn btn-danger"
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
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
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>👥</div>
            <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>
              No Users Yet
            </h3>
            <p style={{ marginBottom: "24px" }}>
              Add your first team member to get started.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              Add New User
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
