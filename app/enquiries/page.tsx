"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@/components/AppLayout";
import { canCreate, canUpdate, getRoleFromUser } from "@/lib/rbac";
import ProtectedRoute from "@/components/ProtectedRoute";
import { enquiriesAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

function StatusDropdown({
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;

      // Menu is rendered in a portal (outside ref). Keep it open for clicks inside it.
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      if (ref.current?.contains(target)) return;

      setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  const computePosition = () => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuWidth = 200;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, window.innerWidth - menuWidth - margin),
    );
    const top = rect.bottom + 8;
    setPos({ top, left, width: menuWidth });
  };

  useEffect(() => {
    if (!open) return;
    computePosition();

    const onScroll = () => computePosition();
    const onResize = () => computePosition();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        ref={buttonRef}
        disabled={!!disabled}
        onClick={() => !disabled && setOpen((s) => !s)}
        className={`h-10 w-[150px] rounded-md border bg-white px-3 text-left text-sm shadow-sm transition\n          ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-slate-50"}\n          ${open ? "border-sky-500 ring-2 ring-sky-500/30" : "border-slate-300"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-slate-900">
            {selected ? selected.label : placeholder}
          </span>
          <span className="text-slate-500">▾</span>
        </span>
      </button>

      {open && typeof document !== "undefined" && pos
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-[9999] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              {options.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm\n                    ${isSelected ? "bg-sky-50 text-sky-700" : "text-slate-700"}\n                    hover:bg-slate-50`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <span className="text-sky-700">✓</span>}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default function Enquiries() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const user = useUser();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const [filters, setFilters] = useState({
    q: "",
    city: "",
    area: "",
    location: "",
    status: "",
  });

  const [formData, setFormData] = useState({
    clientName: "",
    phone: "",
    email: "",
    city: "",
    area: "",
    location: "",
    purpose: "",
  });

  useEffect(() => {
    if (user) {
      fetchData(1, true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      fetchData(1, true);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, user]);

  const fetchData = async (pageToLoad: number, reset: boolean) => {
    try {
      setLoading(true);
      const res = await enquiriesAPI.getAll({
        page: pageToLoad,
        limit: PAGE_SIZE,
        q: filters.q || undefined,
        city: filters.city || undefined,
        area: filters.area || undefined,
        location: filters.location || undefined,
        status: filters.status || undefined,
      });

      const payload = res?.data || {};
      const rows = Array.isArray(payload?.inquiries) ? payload.inquiries : [];
      const count =
        typeof payload?.total === "number" ? payload.total : rows.length;
      setTotal(count);
      setInquiries((prev) => (reset ? rows : [...(prev || []), ...rows]));
      setPage(pageToLoad);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      if (reset) setInquiries([]);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        clientName: formData.clientName,
        phone: formData.phone,
        email: formData.email || undefined,
        city: formData.city,
        area: formData.area,
        location: formData.location,
        purpose: formData.purpose || undefined,
      };

      const res = await enquiriesAPI.create(payload as any);
      setShowForm(false);
      setFormData({
        clientName: "",
        phone: "",
        email: "",
        city: "",
        area: "",
        location: "",
        purpose: "",
      });
      // If backend returns existing inquiry (owner), it returns 200 with message.
      const msg = res?.message || "Inquiry saved";
      showSuccess(msg);
      fetchData(1, true);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to create inquiry";
      showError(msg);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await enquiriesAPI.update(id, { status } as any);
      const updated = res?.data;

      setInquiries((prev) => {
        const rows = Array.isArray(prev) ? prev : [];

        // If a status filter is active and the new status no longer matches, remove the row.
        if (
          filters.status &&
          String(filters.status).toUpperCase() !== String(status).toUpperCase()
        ) {
          return rows.filter((r) => r?.id !== id);
        }

        return rows.map((r) => {
          if (r?.id !== id) return r;
          if (updated && typeof updated === "object") {
            return { ...r, ...updated };
          }
          return { ...r, status };
        });
      });

      if (
        filters.status &&
        String(filters.status).toUpperCase() !== String(status).toUpperCase()
      ) {
        setTotal((t) => (typeof t === "number" && t > 0 ? t - 1 : t));
      }
      showSuccess("Status updated");
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to update inquiry";
      showError(msg);
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const userRole = getRoleFromUser(user);
  const canCreateInquiry = canCreate(userRole, "enquiries");
  const canUpdateInquiry = canUpdate(userRole, "enquiries");
  const isSalesRole = (userRole || "").toLowerCase() === "sales";

  const statusOptions = useMemo(
    () => [
      { value: "", label: "All Status" },
      { value: "OPEN", label: "OPEN" },
      { value: "LOCKED", label: "LOCKED" },
      { value: "CLOSED", label: "CLOSED" },
    ],
    [],
  );

  // Don't show loading spinner - show content immediately with empty state if needed

  return (
    <ProtectedRoute component="enquiries">
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h1>Inquiries</h1>
          {canCreateInquiry && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn btn-primary"
            >
              {showForm ? "Cancel" : "New Inquiry"}
            </button>
          )}
        </div>

        {showForm && canCreateInquiry && (
          <div className="card">
            <h3>Create New Inquiry</h3>
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "15px",
                }}
              >
                <div className="form-group">
                  <label>Client Name *</label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) =>
                      setFormData({ ...formData, clientName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
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
                    placeholder="optional"
                  />
                </div>
                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        city: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Area *</label>
                  <input
                    type="text"
                    value={formData.area}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        area: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Location / Landmark *</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label>Purpose / Notes</label>
                  <textarea
                    value={formData.purpose}
                    onChange={(e) =>
                      setFormData({ ...formData, purpose: e.target.value })
                    }
                    rows={3}
                    placeholder="optional"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Save Inquiry
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
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0 }}>All Inquiries</h3>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Search client name"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="h-10 w-[240px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              />
              <input
                type="text"
                placeholder="City"
                value={filters.city}
                onChange={(e) =>
                  setFilters({ ...filters, city: e.target.value })
                }
                className="h-10 w-[160px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              />
              <input
                type="text"
                placeholder="Area"
                value={filters.area}
                onChange={(e) =>
                  setFilters({ ...filters, area: e.target.value })
                }
                className="h-10 w-[160px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              />
              <input
                type="text"
                placeholder="Location"
                value={filters.location}
                onChange={(e) =>
                  setFilters({ ...filters, location: e.target.value })
                }
                className="h-10 w-[200px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              />
              <StatusDropdown
                value={filters.status}
                onChange={(v) => setFilters({ ...filters, status: v })}
                placeholder="All Status"
                options={statusOptions}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "16px" }}>Loading...</div>
          ) : inquiries.length > 0 ? (
            <table className="table" style={{ marginTop: "16px" }}>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>Area</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry) => {
                  const createdByRole = String(
                    inquiry?.createdBy?.role?.name || "",
                  ).toLowerCase();
                  const salesReadOnly =
                    isSalesRole && createdByRole === "owner";
                  return (
                    <tr key={inquiry.id}>
                      <td>{inquiry.clientName}</td>
                      <td>{inquiry.phone}</td>
                      <td>{inquiry.city}</td>
                      <td>{inquiry.area}</td>
                      <td>{inquiry.location}</td>
                      <td>{inquiry.status}</td>
                      <td>
                        {inquiry?.createdBy?.name || "-"}
                        {createdByRole ? ` (${createdByRole})` : ""}
                      </td>
                      <td>
                        {inquiry.createdAt
                          ? new Date(inquiry.createdAt).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>
                        {isSalesRole ? (
                          <StatusDropdown
                            value={String(inquiry.status || "")}
                            onChange={() => {
                              // Sales cannot change inquiry status (backend-enforced)
                            }}
                            placeholder={String(inquiry.status || "Status")}
                            options={statusOptions.filter(
                              (o) => o.value !== "",
                            )}
                            disabled
                          />
                        ) : canUpdateInquiry && !salesReadOnly ? (
                          <StatusDropdown
                            value={String(inquiry.status || "")}
                            onChange={(v) => handleUpdateStatus(inquiry.id, v)}
                            placeholder={String(inquiry.status || "Status")}
                            options={statusOptions.filter(
                              (o) => o.value !== "",
                            )}
                          />
                        ) : (
                          <span>{inquiry.status}</span>
                        )}
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
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
              <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>
                No Inquiries Yet
              </h3>
              <p style={{ marginBottom: "24px" }}>
                Start tracking client requirements by creating your first
                inquiry.
              </p>
              {canCreateInquiry && (
                <button
                  onClick={() => setShowForm(true)}
                  className="btn btn-primary"
                >
                  New Inquiry
                </button>
              )}
            </div>
          )}

          {!loading && inquiries.length > 0 && inquiries.length < total && (
            <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => fetchData(page + 1, false)}
              >
                Load more
              </button>
              <div
                style={{ alignSelf: "center", color: "var(--text-secondary)" }}
              >
                Showing {inquiries.length} of {total}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
