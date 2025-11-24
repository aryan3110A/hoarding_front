"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout, { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";
import { usersAPI, rolesAPI } from "@/lib/api";

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUser();
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
    if (user) {
      fetchUsers();
      fetchRoles();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      if (response.success && response.data) {
        setUsers(response.data);
      } else {
        setUsers([]);
      }
      setLoading(false); // Set loading to false immediately after setting data
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      setUsers([]);
      setLoading(false); // Set loading to false on error too
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
        alert("User created successfully!");
      }
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to create user"
      );
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
      (r) => r.name.toLowerCase() === (user.role?.toLowerCase() || "")
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
        alert("User updated successfully!");
      }
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to update user"
      );
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete user "${userName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await usersAPI.delete(userId);
      if (response.success) {
        fetchUsers();
        alert("User deleted successfully!");
      }
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to delete user"
      );
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      const response = await usersAPI.update(userId, { isActive: !isActive });
      if (response.success) {
        fetchUsers();
      }
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to update user"
      );
    }
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
  if (userRole !== "owner" && userRole !== "admin") {
    return <AccessDenied />;
  }

  const getRoleName = (roleId: number | string | null) => {
    if (!roleId) return "N/A";
    const role = roles.find((r) => r.id === parseInt(roleId.toString()));
    return role ? role.name : "N/A";
  };

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
            }}
          >
            <h3>All Users ({users.length})</h3>
            {users.length > 0 && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {roles.map((role) => {
                  const count = users.filter(
                    (u) => u.role?.toLowerCase() === role.name.toLowerCase()
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
    </AppLayout>
  );
}
