"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser } from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { todosAPI } from "@/lib/api";
import { getRoleFromUser } from "@/lib/rbac";
import { showError, showSuccess } from "@/lib/toast";

export default function TasksPage() {
  const user = useUser();
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "private" | "public" | "role">("all");

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    visibility: "private",
    roleName: "",
    tags: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Available roles for visibility scope
  const availableRoles = ["owner", "manager", "sales", "designer", "supervisor", "accountant", "admin"];

  const loadTodos = async () => {
    try {
      setLoading(true);
      const res = await todosAPI.list();
      setTodos(Array.isArray(res?.data) ? res.data : []);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to load to-do items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTodos();
    }
  }, [user]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showError("Title is required");
      return;
    }
    if (formData.visibility === "role" && !formData.roleName) {
      showError("Please select a target role for role-based visibility");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        dueDate: formData.dueDate || undefined,
        visibility: formData.visibility,
        roleName: formData.visibility === "role" ? formData.roleName : undefined,
        tags: formData.tags.trim() || undefined,
      };

      const res = editingId
        ? await todosAPI.update(editingId, payload)
        : await todosAPI.create(payload);
      if (res?.success) {
        showSuccess(editingId ? "Task updated successfully" : "Task created successfully");
        setShowAddForm(false);
        setEditingId(null);
        setFormData({
          title: "",
          description: "",
          dueDate: "",
          visibility: "private",
          roleName: "",
          tags: "",
        });
        loadTodos();
      } else {
        showError(res?.message || "Failed to create task");
      }
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    try {
      // Optimistic update
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
      );

      const res = await todosAPI.update(id, { status: newStatus });
      if (!res?.success) {
        // Rollback on failure
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: currentStatus } : t))
        );
        showError(res?.message || "Failed to update task status");
      }
    } catch (err: any) {
      // Rollback on failure
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: currentStatus } : t))
      );
      showError(err?.response?.data?.message || "Failed to update task status");
    }
  };

  const handleDeleteTodo = async (id: string) => {
    const ok = window.confirm("Are you sure you want to delete this task?");
    if (!ok) return;

    try {
      const res = await todosAPI.delete(id);
      if (res?.success) {
        showSuccess("Task deleted successfully");
        setTodos((prev) => prev.filter((t) => t.id !== id));
      } else {
        showError(res?.message || "Failed to delete task");
      }
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to delete task");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: "",
      description: "",
      dueDate: "",
      visibility: "private",
      roleName: "",
      tags: "",
    });
  };

  const startEdit = (todo: any) => {
    setEditingId(String(todo.id));
    setShowAddForm(true);
    setFormData({
      title: String(todo.title || ""),
      description: String(todo.description || ""),
      dueDate: todo.dueDate ? String(todo.dueDate).slice(0, 10) : "",
      visibility: String(todo.visibility || "private"),
      roleName: String(todo.roleName || ""),
      tags: String(todo.tags || ""),
    });
  };

  const filteredTodos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return todos.filter((t) => {
      if (activeTab !== "all" && String(t.visibility).toLowerCase() !== activeTab) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        t.title,
        t.description,
        t.status,
        t.tags,
        t.visibility,
        t.roleName,
        t.createdBy?.name,
        t.createdBy?.email,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(q);
    });
  }, [todos, activeTab, search]);

  const formatDate = (value: unknown) => {
    if (!value) return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const suggestedTags = [
    "Printing",
    "Mounting",
    "Client Follow-up",
    "Site Visit",
    "Maintenance",
    "Artwork",
    "Payment",
    "Urgent",
  ];

  const toggleSuggestedTag = (tag: string) => {
    const current = formData.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const next = current.some((item) => item.toLowerCase() === tag.toLowerCase())
      ? current.filter((item) => item.toLowerCase() !== tag.toLowerCase())
      : [...current, tag];
    setFormData({ ...formData, tags: next.join(", ") });
  };

  return (
    <ProtectedRoute component="tasks">
      <div className="tasks-page">
        <div className="mobile-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>Tasks</h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.85)", fontSize: 14 }}>
              Track follow-ups, site work, and internal action items.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (showAddForm) resetForm();
              setShowAddForm(!showAddForm);
            }}
          >
            {showAddForm ? "Close" : "New Task"}
          </button>
        </div>

          {showAddForm && (
            <div className="card tasks-form-card">
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>
                {editingId ? "Edit task" : "New task"}
              </h3>
              <form onSubmit={handleAddTodo}>
                <div className="tasks-form-grid">
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Example: Mount flex at CG Road"
                      required
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Client, hoarding, location, or next step"
                      rows={2}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Tags</label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="Printing, Mounting, Urgent"
                    />
                    <div className="tasks-tag-picks">
                      {suggestedTags.map((tag) => {
                        const selected = formData.tags
                          .split(",")
                          .map((item) => item.trim().toLowerCase())
                          .includes(tag.toLowerCase());
                        return (
                          <button
                            key={tag}
                            type="button"
                            className={selected ? "tasks-tag-pick selected" : "tasks-tag-pick"}
                            onClick={() => toggleSuggestedTag(tag)}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Due date</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Visibility</label>
                    <select
                      value={formData.visibility}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          visibility: e.target.value,
                          roleName: e.target.value !== "role" ? "" : formData.roleName,
                        })
                      }
                    >
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                      <option value="role">Role</option>
                    </select>
                  </div>
                  {formData.visibility === "role" && (
                    <div className="form-group">
                      <label>Role *</label>
                      <select
                        value={formData.roleName}
                        onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                        required
                      >
                        <option value="">Choose role</option>
                        {availableRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="tasks-form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Saving..." : editingId ? "Update task" : "Save task"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card tasks-list-card">
            <div className="tasks-toolbar">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, description, status, tags, or user"
              />
              <div className="tasks-segment" role="tablist">
                {[
                  { id: "all", label: "All" },
                  { id: "private", label: "Private" },
                  { id: "public", label: "Public" },
                  { id: "role", label: "Role" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={activeTab === tab.id ? "active" : ""}
                    onClick={() => setActiveTab(tab.id as any)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="tasks-empty">Loading tasks...</p>
            ) : filteredTodos.length === 0 ? (
              <p className="tasks-empty">No tasks match this view.</p>
            ) : (
              <div className="tasks-table-wrap">
                <table className="tasks-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Task</th>
                      <th>Due</th>
                      <th>Scope</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTodos.map((todo) => {
                      const isDone = todo.status === "done";
                      const isCreator = String(todo.createdById) === String(user?.id);
                      const canManage =
                        isCreator ||
                        ["owner", "admin"].includes(String(getRoleFromUser(user) || "").toLowerCase());
                      return (
                        <tr key={todo.id} className={isDone ? "is-done" : ""}>
                          <td>
                            <button
                              type="button"
                              className={isDone ? "tasks-check done" : "tasks-check"}
                              onClick={() => handleToggleStatus(todo.id, todo.status)}
                              aria-label={isDone ? "Mark pending" : "Mark done"}
                            >
                              {isDone ? "✓" : ""}
                            </button>
                          </td>
                          <td>
                            <div className="tasks-title">{todo.title}</div>
                            {todo.description ? <div className="tasks-desc">{todo.description}</div> : null}
                            {todo.tags ? (
                              <div className="tasks-tags">
                                {String(todo.tags)
                                  .split(",")
                                  .map((tag: string) => tag.trim())
                                  .filter(Boolean)
                                  .map((tag: string) => (
                                    <span key={tag}>{tag}</span>
                                  ))}
                              </div>
                            ) : null}
                            <div className="tasks-meta">
                              {todo.createdBy?.name || "System"}
                            </div>
                          </td>
                          <td>{formatDate(todo.dueDate) || "—"}</td>
                          <td>
                            {todo.visibility === "role"
                              ? `Role · ${String(todo.roleName || "").toLowerCase()}`
                              : String(todo.visibility || "private")}
                          </td>
                          <td className="tasks-actions">
                            {canManage ? (
                              <button type="button" onClick={() => startEdit(todo)}>
                                Edit
                              </button>
                            ) : null}
                            {isCreator ? (
                              <button type="button" className="danger" onClick={() => handleDeleteTodo(todo.id)}>
                                Delete
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <style jsx global>{`
            .tasks-page .card:hover {
              transform: none;
            }
            .tasks-form-card,
            .tasks-list-card {
              padding: 16px 18px;
            }
            .tasks-form-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 10px 14px;
            }
            .tasks-form-card .form-group {
              margin-bottom: 0;
            }
            .tasks-form-card .form-group label {
              margin-bottom: 4px;
              font-size: 13px;
            }
            .tasks-form-card .form-group input,
            .tasks-form-card .form-group select,
            .tasks-form-card .form-group textarea {
              padding: 8px 12px;
            }
            .tasks-tag-picks {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin-top: 8px;
            }
            .tasks-tag-pick {
              border: 1px solid #cbd5e1;
              background: #fff;
              color: #334155;
              border-radius: 999px;
              padding: 4px 10px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
              outline: none;
            }
            .tasks-tag-pick.selected {
              background: #e0f2fe;
              border-color: #7dd3fc;
              color: #0369a1;
            }
            .tasks-form-actions {
              display: flex;
              justify-content: flex-end;
              gap: 8px;
              margin-top: 12px;
            }
            .tasks-toolbar {
              display: flex;
              gap: 12px;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              margin-bottom: 12px;
            }
            .tasks-toolbar input {
              flex: 1;
              min-width: 220px;
              padding: 8px 12px;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              font-size: 14px;
            }
            .tasks-segment {
              display: inline-flex;
              background: #f1f5f9;
              border-radius: 8px;
              padding: 3px;
              gap: 2px;
            }
            .tasks-segment button {
              border: 0;
              background: transparent;
              color: #475569;
              font-size: 13px;
              font-weight: 600;
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              outline: none;
              box-shadow: none;
            }
            .tasks-segment button.active,
            .tasks-segment button:focus,
            .tasks-segment button:focus-visible {
              outline: none;
              box-shadow: none;
            }
            .tasks-segment button.active {
              background: #fff;
              color: #0f172a;
            }
            .tasks-empty {
              margin: 8px 0 4px;
              color: #64748b;
              text-align: center;
              padding: 28px 0;
            }
            .tasks-table-wrap {
              overflow-x: auto;
            }
            .tasks-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 14px;
            }
            .tasks-table th {
              text-align: left;
              font-size: 12px;
              letter-spacing: 0.02em;
              text-transform: uppercase;
              color: #64748b;
              padding: 8px;
              border-bottom: 1px solid #e2e8f0;
            }
            .tasks-table td {
              padding: 10px 8px;
              border-bottom: 1px solid #f1f5f9;
              vertical-align: top;
              color: #0f172a;
            }
            .tasks-table tr.is-done .tasks-title,
            .tasks-table tr.is-done .tasks-desc {
              color: #94a3b8;
              text-decoration: line-through;
            }
            .tasks-title {
              font-weight: 650;
            }
            .tasks-desc,
            .tasks-meta {
              color: #64748b;
              font-size: 12px;
              margin-top: 2px;
            }
            .tasks-tags {
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
              margin-top: 6px;
            }
            .tasks-tags span {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              color: #334155;
              border-radius: 999px;
              padding: 1px 8px;
              font-size: 11px;
              font-weight: 600;
            }
            .tasks-check {
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 1px solid #cbd5e1;
              background: #fff;
              cursor: pointer;
              outline: none;
              color: #fff;
              font-size: 12px;
              line-height: 1;
            }
            .tasks-check.done {
              background: #0f766e;
              border-color: #0f766e;
            }
            .tasks-actions {
              white-space: nowrap;
              text-align: right;
            }
            .tasks-actions button {
              border: 0;
              background: transparent;
              color: #0369a1;
              font-weight: 600;
              font-size: 13px;
              cursor: pointer;
              outline: none;
              padding: 0 6px;
            }
            .tasks-actions button.danger {
              color: #b91c1c;
            }
            @media (max-width: 720px) {
              .tasks-form-grid {
                grid-template-columns: 1fr;
              }
            }
          `}</style>
      </div>
    </ProtectedRoute>
  );
}
