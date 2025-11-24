"use client";

import { useEffect, useState } from "react";
import AppLayout, { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";
import { rolesAPI } from "@/lib/api";

export default function Roles() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUser();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
  });
  const [editingRole, setEditingRole] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
  });

  useEffect(() => {
    if (user) {
      fetchRoles();
    }
  }, [user]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await rolesAPI.getAll();
      if (response.success && response.data) {
        setRoles(response.data);
      } else {
        setRoles([]);
      }
      setLoading(false); // Set loading to false immediately after setting data
    } catch (error: any) {
      console.error("Failed to fetch roles:", error);
      setRoles([]);
      setLoading(false); // Set loading to false on error too
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await rolesAPI.create({ name: formData.name });
      if (response.success) {
        setShowForm(false);
        setFormData({ name: "" });
        fetchRoles();
        alert("Role created successfully!");
      }
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to create role"
      );
    }
  };

  const handleEdit = (role: any) => {
    setEditingRole(role);
    setEditFormData({ name: role.name });
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    try {
      const response = await rolesAPI.update(editingRole.id, {
        name: editFormData.name,
      });
      if (response.success) {
        setEditingRole(null);
        fetchRoles();
        alert("Role updated successfully!");
      }
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to update role"
      );
    }
  };

  const handleDeleteRole = async (roleId: number, roleName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete role "${roleName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await rolesAPI.delete(roleId);
      if (response.success) {
        fetchRoles();
        alert("Role deleted successfully!");
      }
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to delete role"
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

  // Don't show loading spinner - show content immediately with empty state if needed

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
          <h1>Role Management</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-primary"
          >
            {showForm ? "Cancel" : "Create New Role"}
          </button>
        </div>

        {editingRole && (
          <div
            className="card"
            style={{
              marginBottom: "24px",
              border: "2px solid var(--primary-color)",
              background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
            }}
          >
            <h3 style={{ marginBottom: "20px", color: "var(--primary-color)" }}>
              ✏️ Edit Role: {editingRole.name}
            </h3>
            <form onSubmit={handleUpdateRole}>
              <div className="form-group">
                <label>Role Name *</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  required
                  placeholder="e.g., Accountant, Supervisor"
                />
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button type="submit" className="btn btn-primary">
                  💾 Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="btn btn-secondary"
                >
                  ❌ Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showForm && (
          <div className="card" style={{ marginBottom: "24px" }}>
            <h3>Create New Role</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Role Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  placeholder="e.g., Accountant, Supervisor, Coordinator"
                />
                <small
                  style={{
                    color: "var(--text-secondary)",
                    marginTop: "5px",
                    display: "block",
                  }}
                >
                  Role names will be converted to lowercase automatically
                </small>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: "20px" }}
              >
                Create Role
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <h3>All Roles ({roles.length})</h3>
          {roles.length > 0 ? (
            <table className="table" style={{ marginTop: "16px" }}>
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Users Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const userCount = (role as any)._count?.users || 0;
                  return (
                    <tr key={role.id}>
                      <td>
                        <strong style={{ textTransform: "capitalize" }}>
                          {role.name}
                        </strong>
                      </td>
                      <td>
                        <span className="badge badge-info">{userCount}</span>
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
                            onClick={() => handleEdit(role)}
                            className="btn btn-primary"
                            style={{ padding: "5px 10px", fontSize: "12px" }}
                          >
                            ✏️ Edit
                          </button>
                          {userCount === 0 ? (
                            <button
                              onClick={() =>
                                handleDeleteRole(role.id, role.name)
                              }
                              className="btn btn-danger"
                              style={{ padding: "5px 10px", fontSize: "12px" }}
                            >
                              🗑️ Delete
                            </button>
                          ) : (
                            <button
                              disabled
                              className="btn btn-secondary"
                              style={{ padding: "5px 10px", fontSize: "12px" }}
                              title="Cannot delete role with assigned users"
                            >
                              🗑️ Delete (In Use)
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                No Roles Yet
              </h3>
              <p style={{ marginBottom: "24px" }}>
                Create your first role to start managing user permissions.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="btn btn-primary"
              >
                Create New Role
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
