"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
// AppLayout is provided at the root; do not wrap pages again.
import { categoriesAPI, hoardingsAPI, landlordsAPI } from "@/lib/api";
import CustomSelect from "@/components/CustomSelect";
import { showError } from "@/lib/toast";

type LandlordRow = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export default function NewHoarding() {
  const [formData, setFormData] = useState({
    code: "",
    propertyGroupId: "", // NEW: groups multiple hoardings under one property
    landlordId: "",
    city: "",
    area: "",
    categoryId: "",
    landmark: "",
    roadName: "",
    side: "",
    width: "",
    height: "",
    type: "",
    ownership: "Private",
    status: "available",
    standardRate: "",
    minimumRate: "",
    lat: "",
    lng: "",
  });
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [landlords, setLandlords] = useState<LandlordRow[]>([]);
  const [landlordSearch, setLandlordSearch] = useState("");
  const [loadingLandlords, setLoadingLandlords] = useState(false);
  const [landlordDropdownOpen, setLandlordDropdownOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [landlordDropdownRect, setLandlordDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const landlordRootRef = useRef<HTMLDivElement | null>(null);
  const landlordInputRef = useRef<HTMLInputElement | null>(null);
  const landlordMenuRef = useRef<HTMLDivElement | null>(null);
  const [showAddLandlordModal, setShowAddLandlordModal] = useState(false);
  const [creatingLandlord, setCreatingLandlord] = useState(false);
  const [newLandlordForm, setNewLandlordForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [landlordModalError, setLandlordModalError] = useState("");
  const router = useRouter();

  const fieldLabelMap: Record<string, string> = {
    code: "Hoarding Code",
    propertyGroupId: "Property Group ID",
    landlordId: "Landlord",
    city: "City",
    area: "Area/Zone",
    categoryId: "Category",
    landmark: "Landmark",
    roadName: "Road Name / Facing Direction",
    side: "Side",
    widthCm: "Width",
    heightCm: "Height",
    width: "Width",
    height: "Height",
    type: "Hoarding Type",
    ownership: "Ownership",
    status: "Status",
    standardRate: "Standard Rate",
    minimumRate: "Minimum Rate",
    lat: "Latitude",
    lng: "Longitude",
  };

  const toFriendlyField = (rawField: unknown) => {
    const fieldPath = String(rawField || "")
      .replace(/^body\./, "")
      .replace(/^query\./, "")
      .replace(/^params\./, "")
      .trim();

    if (!fieldPath) return "Field";
    if (fieldLabelMap[fieldPath]) return fieldLabelMap[fieldPath];

    return fieldPath
      .split(".")
      .map((part) => fieldLabelMap[part] || part)
      .join(" ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getFriendlyValidationMessage = (err: any): string | null => {
    const details = err?.response?.data?.error;
    if (!Array.isArray(details) || details.length === 0) return null;

    const first = details[0] || {};
    const field = toFriendlyField(first?.field);
    const rawMessage = String(first?.message || "").trim();

    if (!rawMessage) {
      return `${field} is invalid`;
    }

    if (/expected number, received null/i.test(rawMessage)) {
      return `${field} is required`;
    }

    if (/expected number, received nan/i.test(rawMessage)) {
      return `${field} must be a valid number`;
    }

    if (/expected string, received null/i.test(rawMessage)) {
      return `${field} is required`;
    }

    if (/invalid enum value/i.test(rawMessage)) {
      return `${field} has an invalid value`;
    }

    if (/required/i.test(rawMessage)) {
      return `${field} is required`;
    }

    if (rawMessage.toLowerCase().includes(field.toLowerCase())) {
      return rawMessage;
    }

    return `${field}: ${rawMessage}`;
  };

  const loadCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setCategories([]);
    }
  };

  useEffect(() => {
    loadCategories();
    loadLandlords();
    setPortalReady(true);
  }, []);

  const normalizeText = (value: unknown) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const loadLandlords = async (query?: string) => {
    try {
      setLoadingLandlords(true);
      const res = await landlordsAPI.list(
        query && query.trim() ? { q: query.trim() } : undefined,
      );
      const rows = Array.isArray(res?.data) ? res.data : [];
      setLandlords(rows);
    } catch {
      setLandlords([]);
    } finally {
      setLoadingLandlords(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLandlords(landlordSearch);
    }, 250);

    return () => clearTimeout(timer);
  }, [landlordSearch]);

  const selectedLandlord = useMemo(
    () => landlords.find((l) => l.id === formData.landlordId) || null,
    [landlords, formData.landlordId],
  );

  const landlordSuggestions = useMemo(() => {
    const q = normalizeText(landlordSearch);
    const rows = q
      ? landlords.filter((landlord) => {
          return (
            normalizeText(landlord.name).includes(q) ||
            normalizeText(landlord.phone).includes(q)
          );
        })
      : landlords;

    return [...rows].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );
  }, [landlords, landlordSearch]);

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "Select category" },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  );

  const ownershipOptions = [
    { value: "Private", label: "Private" },
    { value: "Government", label: "Government" },
    { value: "Friend", label: "Friend" },
  ];

  const statusOptions = [
    { value: "available", label: "Available" },
    { value: "occupied", label: "Occupied" },
  ];

  const sideOptions = [
    { value: "", label: "None" },
    { value: "LHS", label: "LHS" },
    { value: "RHS", label: "RHS" },
  ];

  const updateLandlordDropdownRect = () => {
    const el = landlordInputRef.current;
    if (!el) {
      setLandlordDropdownRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const top = r.bottom + 4;
    const viewportBottomGap = Math.max(120, window.innerHeight - top - 12);
    setLandlordDropdownRect({
      top,
      left: r.left,
      width: r.width,
      maxHeight: Math.min(380, viewportBottomGap),
    });
  };

  useLayoutEffect(() => {
    if (!landlordDropdownOpen) return;
    updateLandlordDropdownRect();
    const onScroll = () => updateLandlordDropdownRect();
    const onResize = () => updateLandlordDropdownRect();
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [landlordDropdownOpen, landlordSearch, landlordSuggestions.length]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const node = e.target as Node | null;
      if (!node) return;
      const inRoot = !!landlordRootRef.current?.contains(node);
      const inMenu = !!landlordMenuRef.current?.contains(node);
      if (!inRoot && !inMenu) setLandlordDropdownOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  const openAddLandlordModal = () => {
    setLandlordDropdownOpen(false);
    setLandlordModalError("");
    setNewLandlordForm({
      name: "",
      phone: "",
      email: "",
      address: "",
    });
    setShowAddLandlordModal(true);
  };

  const closeAddLandlordModal = () => {
    if (creatingLandlord) return;
    setShowAddLandlordModal(false);
    setLandlordModalError("");
  };

  const handleCreateLandlord = async (e: React.FormEvent) => {
    e.preventDefault();
    setLandlordModalError("");

    const payload = {
      name: newLandlordForm.name.trim(),
      phone: newLandlordForm.phone.trim() || undefined,
      email: newLandlordForm.email.trim() || undefined,
      address: newLandlordForm.address.trim() || undefined,
    };

    if (!payload.name) {
      setLandlordModalError("Landlord name is required");
      return;
    }

    try {
      setCreatingLandlord(true);
      const res = await landlordsAPI.create(payload);
      const created = res?.data;

      if (!created?.id) {
        setLandlordModalError("Failed to create landlord");
        return;
      }

      setLandlords((prev) => {
        const withoutDup = prev.filter((row) => row.id !== created.id);
        return [created, ...withoutDup].sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || "")),
        );
      });
      setFormData((prev) => ({ ...prev, landlordId: created.id }));
      setLandlordSearch(created.name || "");
      setLandlordDropdownOpen(false);
      setShowAddLandlordModal(false);
    } catch (error: any) {
      const existing = error?.response?.data?.error?.existing;
      if (existing?.id) {
        setLandlords((prev) => {
          const withoutDup = prev.filter((row) => row.id !== existing.id);
          return [existing, ...withoutDup].sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || "")),
          );
        });
        setFormData((prev) => ({ ...prev, landlordId: existing.id }));
        setLandlordSearch(existing.name || "");
        setLandlordDropdownOpen(false);
        setLandlordModalError(
          "Landlord already exists. Existing landlord selected automatically.",
        );
        setShowAddLandlordModal(false);
        return;
      }

      setLandlordModalError(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to create landlord",
      );
    } finally {
      setCreatingLandlord(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.code.trim()) {
        const message = "Hoarding Code is required";
        showError(message);
        setLoading(false);
        return;
      }

      if (!formData.city.trim()) {
        const message = "City is required";
        showError(message);
        setLoading(false);
        return;
      }

      if (!formData.landlordId) {
        const message = "Please select a landlord";
        showError(message);
        setLoading(false);
        return;
      }

      if (!formData.lat.trim()) {
        const message = "Latitude is required";
        showError(message);
        setLoading(false);
        return;
      }

      if (!formData.lng.trim()) {
        const message = "Longitude is required";
        showError(message);
        setLoading(false);
        return;
      }

      if (!formData.standardRate.trim()) {
        const message = "Standard Rate is required";
        showError(message);
        setLoading(false);
        return;
      }

      if (!formData.minimumRate.trim()) {
        const message = "Minimum Rate is required";
        showError(message);
        setLoading(false);
        return;
      }

      const standardRate = formData.standardRate
        ? parseFloat(formData.standardRate)
        : 0;
      const minimumRate = formData.minimumRate
        ? parseFloat(formData.minimumRate)
        : standardRate;

      if (!Number.isFinite(standardRate)) {
        const message = "Standard Rate must be a valid number";
        showError(message);
        setLoading(false);
        return;
      }

      if (!Number.isFinite(minimumRate)) {
        const message = "Minimum Rate must be a valid number";
        showError(message);
        setLoading(false);
        return;
      }

      if (minimumRate > standardRate) {
        const message = "Minimum rate cannot be greater than standard rate";
        showError(message);
        setLoading(false);
        return;
      }

      const widthCm = formData.width.trim()
        ? parseFloat(formData.width) * 30.48
        : null;
      if (
        formData.width.trim() &&
        (widthCm === null || !Number.isFinite(widthCm))
      ) {
        const message = "Width must be a valid number";
        showError(message);
        setLoading(false);
        return;
      }

      const heightCm = formData.height.trim()
        ? parseFloat(formData.height) * 30.48
        : null;
      if (
        formData.height.trim() &&
        (heightCm === null || !Number.isFinite(heightCm))
      ) {
        const message = "Height must be a valid number";
        showError(message);
        setLoading(false);
        return;
      }

      const lat = parseFloat(formData.lat);
      if (!Number.isFinite(lat)) {
        const message = "Latitude must be a valid number";
        showError(message);
        setLoading(false);
        return;
      }

      const lng = parseFloat(formData.lng);
      if (!Number.isFinite(lng)) {
        const message = "Longitude must be a valid number";
        showError(message);
        setLoading(false);
        return;
      }

      const payload: Record<string, unknown> = {
        code: formData.code.trim(),
        landlordId: formData.landlordId,
        city: formData.city.trim(),
        area: formData.area.trim() || undefined,
        landmark: formData.landmark.trim() || undefined,
        roadName: formData.roadName.trim() || undefined,
        ownership: formData.ownership,
        status: formData.status,
        standardRate,
        minimumRate,
        lat,
        lng,
      };

      const propertyGroupId = formData.propertyGroupId.trim();
      if (propertyGroupId) payload.propertyGroupId = propertyGroupId;

      if (formData.categoryId) payload.categoryId = formData.categoryId;
      if (formData.side) payload.side = formData.side;
      if (formData.type.trim()) payload.type = formData.type.trim();
      if (widthCm !== null) payload.widthCm = Math.round(widthCm);
      if (heightCm !== null) payload.heightCm = Math.round(heightCm);

      await hoardingsAPI.create(payload);
      router.push("/hoardings");
    } catch (err: any) {
      const validationMessage = getFriendlyValidationMessage(err);
      const fallbackMessage =
        err?.response?.data?.message || err?.message || "Failed to create hoarding";
      const message =
        validationMessage ||
        (fallbackMessage === "Validation failed"
          ? "Please check required fields and enter valid values"
          : fallbackMessage);

      showError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <button
          className="btn btn-secondary"
          onClick={() => router.push("/hoardings")}
        >
          ← Back to Hoardings
        </button>
      </div>

      <h1>Add New Hoarding</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "15px",
            }}
          >
            <div className="form-group">
              <label>Property Group ID (to group hoardings)</label>
              <input
                type="text"
                value={formData.propertyGroupId}
                onChange={(e) =>
                  setFormData({ ...formData, propertyGroupId: e.target.value })
                }
                placeholder="e.g., ABC-ROAD-01"
              />
            </div>
            <div className="form-group">
              <label>Landlord *</label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <div ref={landlordRootRef} style={{ flex: 1 }}>
                  <input
                    ref={landlordInputRef}
                    type="text"
                    value={landlordSearch}
                    onChange={(e) => {
                      const nextSearch = e.target.value;
                      setLandlordSearch(nextSearch);
                      setLandlordDropdownOpen(true);

                      if (
                        formData.landlordId &&
                        normalizeText(nextSearch) !==
                          normalizeText(selectedLandlord?.name)
                      ) {
                        setFormData((prev) => ({ ...prev, landlordId: "" }));
                      }
                    }}
                    onFocus={() => {
                      setLandlordDropdownOpen(true);
                      if (!landlords.length && !loadingLandlords) {
                        loadLandlords(landlordSearch);
                      }
                    }}
                    placeholder="Search landlord name..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openAddLandlordModal}
                >
                  + Add New Landlord
                </button>
              </div>
              {portalReady && landlordDropdownOpen && landlordDropdownRect
                ? createPortal(
                    <div
                      ref={landlordMenuRef}
                      className="fixed z-[9999] rounded-xl border border-slate-200 bg-white shadow-lg"
                      onWheel={(e) => e.stopPropagation()}
                      style={{
                        top: landlordDropdownRect.top,
                        left: landlordDropdownRect.left,
                        width: landlordDropdownRect.width,
                        maxHeight: landlordDropdownRect.maxHeight,
                        overflowY: "auto",
                      }}
                    >
                      {loadingLandlords ? (
                        <div className="px-3 py-2 text-xs text-slate-500">
                          Loading landlords...
                        </div>
                      ) : null}

                      {!loadingLandlords && landlordSuggestions.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500">
                          No landlords found. You can add a new landlord.
                        </div>
                      ) : null}

                      {!loadingLandlords
                        ? landlordSuggestions.map((landlord) => (
                            <button
                              type="button"
                              key={landlord.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setFormData((prev) => ({
                                  ...prev,
                                  landlordId: landlord.id,
                                }));
                                setLandlordSearch(landlord.name || "");
                                setLandlordDropdownOpen(false);
                              }}
                              className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{landlord.name}</span>
                                {landlord.phone ? (
                                  <span className="text-xs text-slate-500">
                                    {landlord.phone}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          ))
                        : null}
                    </div>,
                    document.body,
                  )
                : null}
              {selectedLandlord && (
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                  }}
                >
                  Selected: {selectedLandlord.name}
                  {selectedLandlord.phone
                    ? ` • ${selectedLandlord.phone}`
                    : ""}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Hoarding Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                required
                placeholder="e.g., MENG-AH-S"
              />
            </div>
            <div className="form-group">
              <label>City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Area/Zone</label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) =>
                  setFormData({ ...formData, area: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <CustomSelect
                value={formData.categoryId}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, categoryId: value }))
                }
                options={categoryOptions}
                placeholder="Select category"
              />
            </div>
            <div className="form-group">
              <label>Landmark</label>
              <input
                type="text"
                value={formData.landmark}
                onChange={(e) =>
                  setFormData({ ...formData, landmark: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Road Name / Facing Direction</label>
              <input
                type="text"
                value={formData.roadName}
                onChange={(e) =>
                  setFormData({ ...formData, roadName: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Side (LHS/RHS)</label>
              <CustomSelect
                value={formData.side}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, side: value }))
                }
                options={sideOptions}
                placeholder="None"
              />
            </div>
            <div className="form-group">
              <label>Width (ft)</label>
              <input
                type="number"
                step="0.1"
                value={formData.width}
                onChange={(e) =>
                  setFormData({ ...formData, width: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Height (ft)</label>
              <input
                type="number"
                step="0.1"
                value={formData.height}
                onChange={(e) =>
                  setFormData({ ...formData, height: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Hoarding Type</label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                placeholder="e.g., Gantry, Hoarding"
              />
            </div>
            <div className="form-group">
              <label>Ownership *</label>
              <CustomSelect
                value={formData.ownership}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, ownership: value }))
                }
                options={ownershipOptions}
                placeholder="Select ownership"
              />
            </div>
            <div className="form-group">
              <label>Status *</label>
              <CustomSelect
                value={formData.status}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
                options={statusOptions}
                placeholder="Select status"
              />
            </div>
            <div className="form-group">
              <label>Standard Rate (₹/month) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.standardRate}
                onChange={(e) =>
                  setFormData({ ...formData, standardRate: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Minimum Rate (₹/month) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.minimumRate}
                onChange={(e) =>
                  setFormData({ ...formData, minimumRate: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Latitude *</label>
              <input
                type="number"
                step="0.0000001"
                value={formData.lat}
                onChange={(e) =>
                  setFormData({ ...formData, lat: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Longitude *</label>
              <input
                type="number"
                step="0.0000001"
                value={formData.lng}
                onChange={(e) =>
                  setFormData({ ...formData, lng: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Hoarding"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/hoardings")}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {showAddLandlordModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeAddLandlordModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(560px, 100%)", padding: "16px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h3 style={{ margin: 0 }}>Add New Landlord</h3>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeAddLandlordModal}
                disabled={creatingLandlord}
              >
                Close
              </button>
            </div>

            {landlordModalError && (
              <div
                style={{
                  marginBottom: "12px",
                  color: "var(--danger-color)",
                }}
              >
                {landlordModalError}
              </div>
            )}

            <form onSubmit={handleCreateLandlord}>
              <div style={{ display: "grid", gap: "12px" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Landlord Name *</label>
                  <input
                    type="text"
                    value={newLandlordForm.name}
                    onChange={(e) =>
                      setNewLandlordForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Phone</label>
                  <input
                    type="text"
                    value={newLandlordForm.phone}
                    onChange={(e) =>
                      setNewLandlordForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={newLandlordForm.email}
                    onChange={(e) =>
                      setNewLandlordForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Address</label>
                  <textarea
                    value={newLandlordForm.address}
                    onChange={(e) =>
                      setNewLandlordForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </div>
              </div>

              <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creatingLandlord}
                >
                  {creatingLandlord ? "Creating..." : "Create Landlord"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeAddLandlordModal}
                  disabled={creatingLandlord}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
