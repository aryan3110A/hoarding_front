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
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    visibility: "private",
    roleName: "",
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
      };

      const res = await todosAPI.create(payload);
      if (res?.success) {
        showSuccess("Task created successfully");
        setShowAddForm(false);
        setFormData({
          title: "",
          description: "",
          dueDate: "",
          visibility: "private",
          roleName: "",
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

  const filteredTodos = useMemo(() => {
    if (activeTab === "all") return todos;
    return todos.filter((t) => String(t.visibility).toLowerCase() === activeTab);
  }, [todos, activeTab]);

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

  const getRoleBadgeColor = (role: string) => {
    const r = String(role).toLowerCase();
    if (r === "owner") return "bg-red-100 text-red-800 border-red-200";
    if (r === "admin") return "bg-purple-100 text-purple-800 border-purple-200";
    if (r === "manager") return "bg-blue-100 text-blue-800 border-blue-200";
    if (r === "sales") return "bg-green-100 text-green-800 border-green-200";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute component="tasks">
      <div className="px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">To-Do List</h1>
              <p className="text-white/80 mt-1 text-sm">
                Organize campaigns, log custom action items, and manage public, private, or role-based checklists.
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="self-start sm:self-auto inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-md transition"
            >
              {showAddForm ? "✕ Close Form" : "➕ Create New Task"}
            </button>
          </div>

          {/* Add Todo Form */}
          {showAddForm && (
            <div className="bg-white/95 backdrop-blur border border-white/20 shadow-xl rounded-2xl p-5 md:p-6 mb-8 text-slate-850">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Create Action Item</h3>
              <form onSubmit={handleAddTodo} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Mount new flex for client Shubham"
                    required
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide additional task context (optional)..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Due Date (optional)
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Visibility Scope
                    </label>
                    <select
                      value={formData.visibility}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          visibility: e.target.value,
                          roleName: e.target.value !== "role" ? "" : formData.roleName,
                        })
                      }
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none"
                    >
                      <option value="private">Private (Only Me)</option>
                      <option value="public">Public (Everyone)</option>
                      <option value="role">Role-Based (Specific Roles)</option>
                    </select>
                  </div>

                  {formData.visibility === "role" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Target Role *
                      </label>
                      <select
                        value={formData.roleName}
                        onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                        required
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none"
                      >
                        <option value="">-- Choose Role --</option>
                        {availableRoles.map((r) => (
                          <option key={r} value={r}>
                            {r.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 text-sm font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow transition"
                  >
                    {submitting ? "Creating..." : "Save Action Item"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filters tabs */}
          <div className="flex flex-wrap gap-3 mb-6">
            {[
              { id: "all", label: "📋 All Tasks" },
              { id: "private", label: "🔒 Private" },
              { id: "public", label: "🌐 Public" },
              { id: "role", label: "👥 Role-Based" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List contents */}
          {loading ? (
            <div className="text-center py-16 bg-white/10 rounded-2xl border border-white/10">
              <div className="loading-spinner mx-auto"></div>
              <p className="text-white mt-4 text-sm">Loading task checklist...</p>
            </div>
          ) : filteredTodos.length === 0 ? (
            <div className="bg-white/95 rounded-2xl border border-white/20 shadow-xl p-10 text-center text-slate-600">
              <div className="text-4xl mb-4 font-semibold text-slate-400">✔️</div>
              <h3 className="text-lg font-bold text-slate-800">Checklist is empty</h3>
              <p className="text-sm mt-1 text-slate-500">
                All caught up! Create a new task to track list deliverables.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTodos.map((todo) => {
                const isDone = todo.status === "done";
                const isCreator = String(todo.createdById) === String(user?.id);

                return (
                  <div
                    key={todo.id}
                    className={`bg-white/95 text-slate-800 rounded-xl p-5 shadow border transition-all flex items-start gap-4 ${
                      isDone ? "border-green-300 bg-green-50/95 opacity-80" : "border-white/20 hover:border-white/40"
                    }`}
                  >
                    {/* Status Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(todo.id, todo.status)}
                      className={`flex-shrink-0 w-6 h-6 rounded-lg border flex items-center justify-center text-xs transition-all ${
                        isDone
                          ? "bg-green-500 border-green-500 text-white font-bold"
                          : "border-slate-300 hover:border-sky-500 hover:bg-sky-50 bg-white"
                      }`}
                    >
                      {isDone && "✓"}
                    </button>

                    {/* Todo Details */}
                    <div className="flex-grow min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {/* Scope tags */}
                        {todo.visibility === "private" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            🔒 Private
                          </span>
                        )}
                        {todo.visibility === "public" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            🌐 Public
                          </span>
                        )}
                        {todo.visibility === "role" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            👥 Role: {todo.roleName?.toUpperCase()}
                          </span>
                        )}

                        {todo.dueDate && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              new Date(todo.dueDate) < new Date() && !isDone
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            📅 Due: {formatDate(todo.dueDate)}
                          </span>
                        )}
                      </div>

                      <h4
                        className={`text-base font-bold text-slate-900 leading-tight ${
                          isDone ? "line-through text-slate-400" : ""
                        }`}
                      >
                        {todo.title}
                      </h4>

                      {todo.description && (
                        <p
                          className={`text-sm text-slate-500 mt-1.5 whitespace-pre-wrap leading-relaxed ${
                            isDone ? "line-through opacity-70" : ""
                          }`}
                        >
                          {todo.description}
                        </p>
                      )}

                      <div className="text-[10px] text-slate-400 mt-2 flex flex-wrap gap-2">
                        <span>
                          Created by: <strong>{todo.createdBy?.name || "System"}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Created at: {new Date(todo.createdAt).toLocaleString("en-IN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Delete actions */}
                    {isCreator && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="flex-shrink-0 text-slate-400 hover:text-red-500 p-1 font-bold text-lg leading-none transition"
                        title="Delete Task"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
