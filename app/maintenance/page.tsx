"use client";

import { useEffect, useMemo, useState } from "react";
import OptionAutocomplete from "@/components/OptionAutocomplete";
import CustomSelect from "@/components/CustomSelect";
import ProtectedRoute from "@/components/ProtectedRoute";
import { categoriesAPI, hoardingsAPI, maintenanceAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

const FALLBACK_TYPES = [
  { value: "LAKDANI_PATTI", label: "Lakdani Patti / Patti Badalvi" },
  { value: "WIRING", label: "Wiring" },
  { value: "CHANGED_BANNER", label: "Changed Banner" },
  { value: "CONTACT_NUMBER", label: "Contact Number Lagavano" },
  { value: "OTHER", label: "Other" },
];

const PAGE_SIZE = 50;

type HoardingFilters = {
  city: string;
  area: string;
  landmark: string;
  status: string;
  categoryId: string;
  type: string;
};

const inputClass =
  "w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 rounded-md";

export default function MaintenancePage() {
  const [filters, setFilters] = useState<HoardingFilters>({
    city: "",
    area: "",
    landmark: "",
    status: "",
    categoryId: "",
    type: "",
  });
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [hoardingsList, setHoardingsList] = useState<any[]>([]);
  const [hoardings, setHoardings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [types, setTypes] = useState(FALLBACK_TYPES);
  const [form, setForm] = useState({
    maintenanceType: "LAKDANI_PATTI",
    maintenanceDate: new Date().toISOString().slice(0, 10),
    performedBy: "",
    remarks: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  const filteredAreaOptions = useMemo(() => {
    const city = filters.city.trim().toLowerCase();
    const source = city
      ? hoardingsList.filter(
          (h: any) => String(h.city || "").toLowerCase() === city,
        )
      : hoardingsList;
    return Array.from(
      new Set(
        source.map((h: any) => String(h.area || "").trim()).filter(Boolean),
      ),
    ).sort();
  }, [hoardingsList, filters.city]);

  const filteredLandmarkOptions = useMemo(() => {
    const city = filters.city.trim().toLowerCase();
    const source = city
      ? hoardingsList.filter(
          (h: any) => String(h.city || "").toLowerCase() === city,
        )
      : hoardingsList;
    return Array.from(
      new Set(
        source
          .map((h: any) => String(h.landmark || "").trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [hoardingsList, filters.city]);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, typeRes, citiesRes, typesRes, hRes, recentRes] =
          await Promise.all([
            categoriesAPI.list().catch(() => ({ data: [] })),
            maintenanceAPI.types().catch(() => ({ data: FALLBACK_TYPES })),
            hoardingsAPI.getCities().catch(() => ({ data: [] })),
            hoardingsAPI.getTypes().catch(() => ({ data: [] })),
            hoardingsAPI.getAll({ limit: 1000 }).catch(() => ({ data: [] })),
            maintenanceAPI.list({ limit: 20 }).catch(() => ({ data: [] })),
          ]);
        setCategories(Array.isArray(catRes?.data) ? catRes.data : []);
        setTypes(
          Array.isArray(typeRes?.data) && typeRes.data.length
            ? typeRes.data
            : FALLBACK_TYPES,
        );
        setCityOptions(
          Array.isArray(citiesRes?.data) ? citiesRes.data.map(String) : [],
        );
        setTypeOptions(
          Array.isArray(typesRes?.data) ? typesRes.data.map(String) : [],
        );
        const rows = Array.isArray(hRes?.data?.hoardings)
          ? hRes.data.hoardings
          : Array.isArray(hRes?.data)
            ? hRes.data
            : [];
        setHoardingsList(rows);
        const payload = recentRes?.data;
        const recentRows = Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload)
            ? payload
            : [];
        setRecent(recentRows);
      } catch {
        setTypes(FALLBACK_TYPES);
      }
    })();
  }, []);

  const fetchHoardings = async (pageNum = 1, reset = false) => {
    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const response = await hoardingsAPI.getAll({
        ...filters,
        page: pageNum,
        limit: PAGE_SIZE,
      });

      if (response?.success && response?.data) {
        const rows = Array.isArray(response.data.hoardings)
          ? response.data.hoardings
          : [];
        const totalCount = Number(response.data.total || 0);
        setTotal(totalCount);
        setHoardings((prev) => {
          const merged = reset ? rows : [...prev, ...rows];
          setHasMore(totalCount > merged.length);
          return merged;
        });
      }
    } catch {
      showError("Failed to load hoardings");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      setPage(1);
      setHasMore(true);
      await fetchHoardings(1, true);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchHoardings(nextPage, false);
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const ids = hoardings.map((h) => h.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const typeLabel = (value: string) =>
    types.find((t) => t.value === value)?.label || value;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) {
      return showError("Select at least one hoarding");
    }
    if (!form.performedBy.trim()) {
      return showError("Enter person who performed maintenance");
    }

    setSaving(true);
    try {
      const ids = Array.from(selectedIds);
      for (const hoardingId of ids) {
        const fd = new FormData();
        fd.append("hoardingId", hoardingId);
        fd.append("maintenanceType", form.maintenanceType);
        fd.append("maintenanceDate", form.maintenanceDate);
        fd.append("performedBy", form.performedBy.trim());
        if (form.remarks.trim()) fd.append("remarks", form.remarks.trim());
        if (photo) fd.append("photo", photo);
        await maintenanceAPI.create(fd);
      }
      showSuccess(
        `Maintenance recorded for ${ids.length} hoarding${ids.length > 1 ? "s" : ""} (status unchanged)`,
      );
      clearSelection();
      setPhoto(null);
      setForm((prev) => ({ ...prev, remarks: "", performedBy: "" }));
      const recentRes = await maintenanceAPI.list({ limit: 20 });
      const payload = recentRes?.data;
      const recentRows = Array.isArray(payload?.rows)
        ? payload.rows
        : Array.isArray(payload)
          ? payload
          : [];
      setRecent(recentRows);
    } catch (err: any) {
      showError(err?.response?.data?.message || "Failed to save maintenance");
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selectedIds.size;
  const visibleAllSelected =
    hoardings.length > 0 &&
    hoardings.every((h) => selectedIds.has(h.id));

  return (
    <ProtectedRoute component="maintenance">
      <div>
        <div
          className="mobile-page-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div>
            <h1>Hoarding Maintenance</h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
              Filter and select one or more hoardings — status is never changed.
            </p>
          </div>
          {selectedCount > 0 && (
            <div className="mobile-page-header-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearSelection}
              >
                Clear selection ({selectedCount})
              </button>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: "16px" }}>
          <h3>Filters</h3>
          <div
            className="mobile-two-column-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                City
              </label>
              <OptionAutocomplete
                value={filters.city}
                onChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    city: value,
                    area: "",
                    landmark: "",
                  }))
                }
                options={cityOptions}
                placeholder="Filter by city"
                className={inputClass}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Area / Zone
              </label>
              <OptionAutocomplete
                value={filters.area}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, area: value }))
                }
                options={filteredAreaOptions}
                placeholder="Filter by area"
                className={inputClass}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Landmark
              </label>
              <OptionAutocomplete
                value={filters.landmark}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, landmark: value }))
                }
                options={filteredLandmarkOptions}
                placeholder="Filter by landmark"
                className={inputClass}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Status
              </label>
              <CustomSelect
                value={filters.status}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, status: value }))
                }
                options={[
                  { value: "", label: "All Status" },
                  { value: "available", label: "Available" },
                  { value: "occupied", label: "Occupied" },
                  { value: "blocked", label: "Blocked" },
                  { value: "booked", label: "Booked" },
                  { value: "under_process", label: "Under Process" },
                  { value: "live", label: "Live" },
                ]}
                placeholder="All Status"
                openDirection="down"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Category
              </label>
              <CustomSelect
                value={filters.categoryId}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, categoryId: value }))
                }
                options={[
                  { value: "", label: "All Categories" },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
                placeholder="All Categories"
                openDirection="down"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Hoarding Type
              </label>
              <OptionAutocomplete
                value={filters.type}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, type: value }))
                }
                options={typeOptions}
                placeholder="Filter by type"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
            gap: "16px",
            alignItems: "start",
          }}
          className="maintenance-layout"
        >
          <div
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              maxHeight: "calc(100vh - 260px)",
              minHeight: 320,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                gap: 12,
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0 }}>
                Select Hoardings{" "}
                <span
                  style={{
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    fontSize: 14,
                  }}
                >
                  ({total} found · {selectedCount} selected)
                </span>
              </h3>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <div
                  className="loading-spinner"
                  style={{ margin: "0 auto" }}
                ></div>
                <p>Loading hoardings...</p>
              </div>
            ) : (
              <div
                className="mobile-scroll-card maintenance-hoarding-scroll"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  overflowX: "auto",
                  border: "1px solid rgba(31, 92, 169, 0.12)",
                  borderRadius: 10,
                }}
              >
                <table className="table" style={{ margin: 0 }}>
                  <thead
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                      background: "#fff",
                    }}
                  >
                    <tr>
                      <th style={{ width: 44 }}>
                        <input
                          type="checkbox"
                          checked={visibleAllSelected}
                          onChange={toggleAllVisible}
                          aria-label="Select all visible"
                        />
                      </th>
                      <th>Code</th>
                      <th>City</th>
                      <th>Location</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoardings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          style={{ textAlign: "center", padding: 30 }}
                        >
                          No hoardings found
                        </td>
                      </tr>
                    ) : (
                      hoardings.map((h) => (
                        <tr
                          key={h.id}
                          onClick={() => toggleOne(h.id)}
                          style={{
                            cursor: "pointer",
                            background: selectedIds.has(h.id)
                              ? "rgba(0, 187, 241, 0.08)"
                              : undefined,
                          }}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(h.id)}
                              onChange={() => toggleOne(h.id)}
                              aria-label={`Select ${h.code}`}
                            />
                          </td>
                          <td>
                            <strong>{h.code || "—"}</strong>
                            {h.side ? ` (${h.side})` : ""}
                          </td>
                          <td>{h.city || "—"}</td>
                          <td>
                            {h.landmark || h.area || h.roadName || "—"}
                          </td>
                          <td>{h.status || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {hasMore && !loading && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>

          <div className="card" style={{ position: "sticky", top: 88 }}>
            <h3 style={{ marginTop: 0 }}>Record Maintenance</h3>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginTop: 0,
              }}
            >
              Applies the same maintenance entry to every selected hoarding.
            </p>

            <form onSubmit={submit} className="grid gap-3">
              <div className="form-group" style={{ margin: 0 }}>
                <label>Selected</label>
                <div
                  style={{
                    fontSize: 14,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(0, 187, 241, 0.08)",
                    border: "1px solid rgba(31, 92, 169, 0.15)",
                  }}
                >
                  {selectedCount === 0
                    ? "No hoardings selected"
                    : `${selectedCount} hoarding${selectedCount > 1 ? "s" : ""} selected`}
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Maintenance Type *</label>
                <CustomSelect
                  value={form.maintenanceType}
                  onChange={(value) =>
                    setForm((p) => ({ ...p, maintenanceType: value }))
                  }
                  options={types.map((t) => ({
                    value: t.value,
                    label: t.label,
                  }))}
                  placeholder="Select type"
                  openDirection="down"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Maintenance Date *</label>
                <input
                  type="date"
                  value={form.maintenanceDate}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      maintenanceDate: e.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Performed By *</label>
                <input
                  type="text"
                  value={form.performedBy}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, performedBy: e.target.value }))
                  }
                  required
                  className={inputClass}
                  placeholder="Person name"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  className={inputClass}
                  rows={3}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Photo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || selectedCount === 0}
              >
                {saving
                  ? "Saving..."
                  : selectedCount > 1
                    ? `Save for ${selectedCount} Hoardings`
                    : "Save Maintenance"}
              </button>
            </form>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Recent Maintenance</h3>
          {recent.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              No maintenance records yet.
            </p>
          ) : (
            <div className="mobile-scroll-card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hoarding</th>
                    <th>Type</th>
                    <th>Performed By</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id}>
                      <td>{String(row.maintenanceDate || "").slice(0, 10)}</td>
                      <td>
                        {row.hoarding?.code || row.hoardingCode || "—"}
                        {row.hoarding?.city
                          ? ` · ${row.hoarding.city}`
                          : ""}
                      </td>
                      <td>{typeLabel(row.maintenanceType)}</td>
                      <td>{row.performedBy || "—"}</td>
                      <td>{row.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <style jsx>{`
          @media (max-width: 980px) {
            .maintenance-layout {
              grid-template-columns: 1fr !important;
            }
          }
          :global(.maintenance-hoarding-scroll thead th) {
            background: #fff;
            box-shadow: 0 1px 0 rgba(15, 23, 42, 0.08);
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
