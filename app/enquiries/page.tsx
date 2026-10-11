"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import OptionAutocomplete from "@/components/OptionAutocomplete";
import { canCreate, canUpdate, getRoleFromUser } from "@/lib/rbac";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  categoriesAPI,
  clientsAPI,
  enquiriesAPI,
  hoardingsAPI,
} from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

const validatePhone = (phone: string) => /^[0-9]{10}$/.test(phone);

function StatusDropdown({
  value,
  onChange,
  placeholder,
  options,
  disabled,
  buttonClassName,
  matchButtonWidth,
  menuWidth,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  buttonClassName?: string;
  matchButtonWidth?: boolean;
  menuWidth?: number;
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
    const desiredWidth = matchButtonWidth
      ? rect.width
      : typeof menuWidth === "number"
        ? menuWidth
        : 200;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, window.innerWidth - desiredWidth - margin),
    );
    const top = rect.bottom + 8;
    setPos({ top, left, width: desiredWidth });
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
        className={`h-10 rounded-md border bg-white px-3 text-left text-sm shadow-sm transition\n          ${buttonClassName || "w-[150px]"}\n          ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-slate-50"}\n          ${open ? "border-sky-500 ring-2 ring-sky-500/30" : "border-slate-300"}`}
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
              className="fixed z-[20000] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
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
  const searchParams = useSearchParams();
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
    status: searchParams?.get("status") || "",
    performanceStage: "",
    categoryId: "",
    assignedSalesId: "",
    assignedToMe: false,
  });

  const [formData, setFormData] = useState({
    clientName: "",
    companyName: "",
    phone: "",
    email: "",
    city: "",
    area: "",
    location: "",
    purpose: "",
    firstContactDate: "",
    nextFollowupDate: "",
    performanceStage: "IN_PROCESS",
    source: "WALK_IN",
    categoryId: "",
    assignedSalesId: "",
    interestedHoardings: "",
  });
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [salesUsers, setSalesUsers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [hoardingsList, setHoardingsList] = useState<any[]>([]);

  // Advanced Hoarding Search Modal States
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalFilters, setModalFilters] = useState({
    code: "",
    city: "",
    area: "",
    landmark: "",
    type: "",
    size: "",
    availability: "",
  });
  const [modalHoardings, setModalHoardings] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTotal, setModalTotal] = useState(0);
  const [modalPage, setModalPage] = useState(1);
  const MODAL_PAGE_SIZE = 10;
  const [landmarkOptions, setLandmarkOptions] = useState<string[]>([]);

  // City-filtered area and landmark options derived from hoardingsList
  const filteredAreaOptions = useMemo(() => {
    const city = modalFilters.city.trim().toLowerCase();
    const source = city
      ? hoardingsList.filter((h: any) => String(h.city || "").toLowerCase() === city)
      : hoardingsList;
    return Array.from(
      new Set(source.map((h: any) => String(h.area || "").trim()).filter(Boolean))
    ).sort();
  }, [hoardingsList, modalFilters.city]);

  const filteredLandmarkOptions = useMemo(() => {
    const city = modalFilters.city.trim().toLowerCase();
    const source = city
      ? hoardingsList.filter((h: any) => String(h.city || "").toLowerCase() === city)
      : hoardingsList;
    return Array.from(
      new Set(source.map((h: any) => String(h.landmark || "").trim()).filter(Boolean))
    ).sort();
  }, [hoardingsList, modalFilters.city]);

  const loadModalHoardings = async (nextPage: number) => {
    setModalLoading(true);
    try {
      const resp = await hoardingsAPI.getAll({
        page: nextPage,
        limit: MODAL_PAGE_SIZE,
        location: modalFilters.code || undefined,
        city: modalFilters.city || undefined,
        area: modalFilters.area || undefined,
        landmark: modalFilters.landmark || undefined,
        type: modalFilters.type || undefined,
        size: modalFilters.size || undefined,
        availability: modalFilters.availability || undefined,
      });
      const payload = resp?.data || {};
      const rows = Array.isArray(payload.hoardings) ? payload.hoardings : [];
      setModalHoardings(rows);
      setModalTotal(Number(payload.total || 0));
      setModalPage(Number(payload.page || nextPage));
    } catch (e) {
      console.error(e);
      setModalHoardings([]);
    } finally {
      setModalLoading(false);
    }
  };

  const toggleModalHoarding = (h: any) => {
    const code = h.code;
    if (!code) return;
    if (selectedHoardings.includes(code)) {
      handleRemoveHoarding(code);
    } else {
      handleAddHoarding(code);
    }
  };

  const selectedHoardings = useMemo(() => {
    return formData.interestedHoardings
      ? formData.interestedHoardings.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  }, [formData.interestedHoardings]);

  const handleAddHoarding = (code: string) => {
    if (!code) return;
    if (selectedHoardings.includes(code)) return;
    const nextList = [...selectedHoardings, code];
    setFormData((prev) => ({
      ...prev,
      interestedHoardings: nextList.join(","),
    }));
  };

  const handleRemoveHoarding = (code: string) => {
    const nextList = selectedHoardings.filter((c) => c !== code);
    setFormData((prev) => ({
      ...prev,
      interestedHoardings: nextList.join(","),
    }));
  };

  const [phoneConflictMessage, setPhoneConflictMessage] = useState("");
  const [matchedClientByPhone, setMatchedClientByPhone] = useState<{
    id?: string;
    name?: string;
    companyName?: string | null;
    email?: string | null;
  } | null>(null);

  const extractListRows = (
    payload: any,
  ): Array<{ id: string; name: string }> => {
    if (Array.isArray(payload))
      return payload as Array<{ id: string; name: string }>;
    if (Array.isArray(payload?.data))
      return payload.data as Array<{ id: string; name: string }>;
    if (Array.isArray(payload?.data?.rows)) {
      return payload.data.rows as Array<{ id: string; name: string }>;
    }
    if (Array.isArray(payload?.data?.categories)) {
      return payload.data.categories as Array<{ id: string; name: string }>;
    }
    return [];
  };

  const normalizeName = (value: string) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const todayInput = () => {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  };

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

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const catRes = await categoriesAPI.list();
        setCategories(extractListRows(catRes));
      } catch {
        setCategories([]);
      }

      try {
        const citiesRes = await hoardingsAPI.getCities();
        setCityOptions(
          Array.isArray(citiesRes?.data) ? citiesRes.data.map(String) : [],
        );
      } catch {
        setCityOptions([]);
      }

      try {
        const hRes = await hoardingsAPI.getAll({ limit: 1000 });
        if (hRes?.success && hRes?.data) {
          const rows = Array.isArray(hRes.data.hoardings)
            ? hRes.data.hoardings
            : Array.isArray(hRes.data)
            ? hRes.data
            : [];
          setHoardingsList(rows);
        }
      } catch (err) {
        console.error("Failed to load hoardings for selector:", err);
      }

      try {
        const landmarksRes = await hoardingsAPI.getLandmarks();
        setLandmarkOptions(
          Array.isArray(landmarksRes?.data) ? landmarksRes.data.map(String) : [],
        );
      } catch {
        setLandmarkOptions([]);
      }

      const roleName = String(getRoleFromUser(user) || "").toLowerCase();
      if (["owner", "manager", "admin"].includes(roleName)) {
        try {
          const salesRes = await enquiriesAPI.listSalesUsers();
          setSalesUsers(extractListRows(salesRes));
        } catch {
          setSalesUsers([]);
        }
      }
    };
    if (user) loadMeta();
  }, [user]);

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
        performanceStage: filters.performanceStage || undefined,
        categoryId: filters.categoryId || undefined,
        assignedSalesId: filters.assignedSalesId || undefined,
        assignedToMe: filters.assignedToMe || undefined,
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
      if (phoneConflictMessage) {
        showError(phoneConflictMessage);
        return;
      }
      if (!validatePhone(formData.phone)) {
        showError("Phone number must be exactly 10 digits");
        return;
      }
      const payload = {
        clientName: formData.clientName,
        companyName: formData.companyName || undefined,
        phone: formData.phone,
        email: formData.email || undefined,
        city: formData.city,
        area: formData.area,
        location: formData.location,
        purpose: formData.purpose || undefined,
        firstContactDate: formData.firstContactDate || undefined,
        nextFollowupDate: formData.nextFollowupDate || undefined,
        performanceStage: formData.performanceStage,
        source: formData.source,
        categoryId: formData.categoryId || undefined,
        assignedSalesId: formData.assignedSalesId || undefined,
        interestedHoardings: formData.interestedHoardings || undefined,
      };

      if (
        formData.nextFollowupDate &&
        formData.nextFollowupDate < todayInput()
      ) {
        showError("Next follow-up date cannot be in the past");
        return;
      }

      const res = await enquiriesAPI.create(payload as any);
      setShowForm(false);
      setFormData({
        clientName: "",
        companyName: "",
        phone: "",
        email: "",
        city: "",
        area: "",
        location: "",
        purpose: "",
        firstContactDate: "",
        nextFollowupDate: "",
        performanceStage: "IN_PROCESS",
        source: "WALK_IN",
        categoryId: "",
        assignedSalesId: "",
        interestedHoardings: "",
      });
      setMatchedClientByPhone(null);
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

  useEffect(() => {
    const rawPhone = String(formData.phone || "").trim();
    const roleName = String(getRoleFromUser(user) || "").toLowerCase();
    const isSalesRole = roleName === "sales";

    if (!rawPhone) {
      setPhoneConflictMessage("");
      setMatchedClientByPhone(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await clientsAPI.byPhone(rawPhone);
        const client = res?.data || null;

        if (isSalesRole) {
          if (client && client?.name) {
            setMatchedClientByPhone(client);
            setFormData((prev) => ({
              ...prev,
              clientName: String(client.name || ""),
              companyName: String(client.companyName || ""),
              email: String(client.email || ""),
            }));
            setPhoneConflictMessage("");
            return;
          }

          // For sales users: if phone doesn't match any client, allow manual entry.
          setMatchedClientByPhone((prev) => {
            if (prev) {
              setFormData((current) => ({
                ...current,
                clientName: "",
                companyName: "",
                email: "",
              }));
            }
            return null;
          });
          setPhoneConflictMessage("");
          return;
        }

        if (client && client?.name) {
          setMatchedClientByPhone(client);
          setFormData((prev) => ({
            ...prev,
            clientName: String(client.name || ""),
            companyName: String(client.companyName || ""),
            email: String(client.email || ""),
          }));
          setPhoneConflictMessage("");
          return;
        }
        setMatchedClientByPhone(null);
        setPhoneConflictMessage("");
      } catch (error) {
        setPhoneConflictMessage("");
        setMatchedClientByPhone(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.phone, user]);

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

  const handleUpdatePerformanceStage = async (
    id: string,
    performanceStage: string,
  ) => {
    try {
      const res = await enquiriesAPI.update(id, { performanceStage } as any);
      const updated = res?.data;

      setInquiries((prev) => {
        const rows = Array.isArray(prev) ? prev : [];
        if (
          filters.performanceStage &&
          String(filters.performanceStage).toUpperCase() !==
            String(performanceStage).toUpperCase()
        ) {
          return rows.filter((r) => r?.id !== id);
        }

        return rows.map((r) => {
          if (r?.id !== id) return r;
          if (updated && typeof updated === "object") {
            return { ...r, ...updated };
          }
          return { ...r, performanceStage };
        });
      });

      if (
        filters.performanceStage &&
        String(filters.performanceStage).toUpperCase() !==
          String(performanceStage).toUpperCase()
      ) {
        setTotal((t) => (typeof t === "number" && t > 0 ? t - 1 : t));
      }
      showSuccess("Funnel stage updated");
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to update funnel stage";
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
  const isOwnerOrManager = ["owner", "manager", "admin"].includes(
    String(userRole || "").toLowerCase(),
  );

  const assignSales = async (inquiryId: string, assignedSalesId: string) => {
    try {
      const res = await enquiriesAPI.assignSales(
        inquiryId,
        assignedSalesId || null,
      );
      const updated = res?.data;
      setInquiries((prev) =>
        (prev || []).map((r) =>
          r?.id === inquiryId ? { ...r, ...updated } : r,
        ),
      );
      showSuccess("Sales person assigned");
    } catch (error: any) {
      showError(
        error?.response?.data?.message || "Failed to assign sales person",
      );
    }
  };

  const statusOptions = useMemo(
    () => [
      { value: "", label: "All Status" },
      { value: "OPEN", label: "OPEN" },
      { value: "LOCKED", label: "LOCKED" },
      { value: "CLOSED", label: "CLOSED" },
    ],
    [],
  );

  const sourceOptions = useMemo(
    () => [
      { value: "WALK_IN", label: "Walk-in" },
      { value: "SELF_GENERATED", label: "Self Generated" },
      { value: "VIA_TELEPHONIC", label: "Via Telephonic" },
      { value: "VIA_WHATSAPP", label: "Via WhatsApp" },
      { value: "REFERENCE", label: "Reference" },
      { value: "OTHERS", label: "Others" },
    ],
    [],
  );

  const performanceStageOptions = useMemo(
    () => [
      { value: "", label: "All Funnel Stages" },
      { value: "IN_PROCESS", label: "In Process" },
      { value: "WON", label: "Won" },
      { value: "FOLLOW_UP_LATER", label: "Follow Up Later" },
      { value: "DEAD", label: "Dead" },
      { value: "NOT_INTERESTED", label: "Not Interested" },
    ],
    [],
  );

  const categoryOptions = useMemo(
    () => [
      ...categories.map((c) => ({ value: String(c.id), label: String(c.name) })),
      { value: "ADD_NEW_CATEGORY", label: "+ Add New Category" }
    ],
    [categories],
  );

  // Don't show loading spinner - show content immediately with empty state if needed

  return (
    <ProtectedRoute component="enquiries">
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
          <h1>Inquiries</h1>
          {canCreateInquiry && (
            <div className="mobile-page-header-actions">
              <button
                onClick={() => setShowForm(!showForm)}
                className="btn btn-primary"
              >
                {showForm ? "Cancel" : "New Inquiry"}
              </button>
            </div>
          )}
        </div>

        {showForm && canCreateInquiry && (
          <div className="card enquiry-create-form">
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Create New Inquiry</h3>
            <form onSubmit={handleSubmit}>
              <div className="enquiry-form-grid">
                <div className="form-group">
                  <label>Phone *</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                    inputMode="numeric"
                    maxLength={10}
                    required
                  />
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "12px",
                      marginTop: "6px",
                    }}
                  >
                    Please enter number without +91
                  </div>
                  {phoneConflictMessage ? (
                    <div
                      style={{
                        color: "#b91c1c",
                        fontSize: "12px",
                        marginTop: "6px",
                      }}
                    >
                      {phoneConflictMessage}
                    </div>
                  ) : matchedClientByPhone ? (
                    <div
                      style={{
                        color: "#0f766e",
                        fontSize: "12px",
                        marginTop: "6px",
                      }}
                    >
                      Existing client details loaded for this phone number.
                      {isOwnerOrManager
                        ? " You can assign this inquiry to another sales person if needed."
                        : ""}
                    </div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label>Client Name *</label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) =>
                      setFormData({ ...formData, clientName: e.target.value })
                    }
                    disabled={!!matchedClientByPhone}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                    disabled={
                      !!matchedClientByPhone &&
                      !!String(matchedClientByPhone?.companyName || "").trim()
                    }
                    placeholder="optional"
                  />
                </div>
                <div className="form-group">
                  <label>Source *</label>
                  <StatusDropdown
                    value={formData.source}
                    onChange={(v) => setFormData({ ...formData, source: v })}
                    placeholder="Select Source"
                    options={sourceOptions}
                    buttonClassName="w-full"
                    matchButtonWidth
                  />
                </div>
                <div className="form-group">
                  <label>Funnel Stage</label>
                  <StatusDropdown
                    value={formData.performanceStage}
                    onChange={(v) =>
                      setFormData({ ...formData, performanceStage: v })
                    }
                    placeholder="Select funnel stage"
                    options={performanceStageOptions.filter(
                      (option) => option.value !== "",
                    )}
                    buttonClassName="w-full"
                    matchButtonWidth
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <StatusDropdown
                    value={formData.categoryId}
                    onChange={(v) => {
                      if (v === "ADD_NEW_CATEGORY") {
                        setShowNewCategory(true);
                        return;
                      }
                      setFormData({ ...formData, categoryId: v });
                    }}
                    placeholder="Select category"
                    options={categoryOptions}
                    buttonClassName="w-full"
                    matchButtonWidth
                  />
                  {showNewCategory ? (
                    <div className="enquiry-new-category">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="New category name"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={savingCategory}
                        onClick={async () => {
                          const name = newCategoryName.trim();
                          if (!name) {
                            showError("Category name is required");
                            return;
                          }
                          try {
                            setSavingCategory(true);
                            const res = await categoriesAPI.create({ name });
                            if (res?.data) {
                              const catRes = await categoriesAPI.list();
                              setCategories(Array.isArray(catRes?.data) ? catRes.data : []);
                              setFormData((prev) => ({ ...prev, categoryId: res.data.id }));
                              setNewCategoryName("");
                              setShowNewCategory(false);
                              showSuccess("Category added");
                            }
                          } catch (err: any) {
                            showError(err?.response?.data?.message || "Failed to create category");
                          } finally {
                            setSavingCategory(false);
                          }
                        }}
                      >
                        {savingCategory ? "Adding..." : "Add"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowNewCategory(false);
                          setNewCategoryName("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </div>
                {isOwnerOrManager ? (
                  <div className="form-group">
                    <label>Assign Sales Person</label>
                    <select
                      value={formData.assignedSalesId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          assignedSalesId: e.target.value,
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {salesUsers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={
                      !!matchedClientByPhone &&
                      !!String(matchedClientByPhone?.email || "").trim()
                    }
                    placeholder="optional"
                  />
                </div>
                <div className="form-group">
                  <label>First Contact Date</label>
                  <input
                    type="date"
                    value={formData.firstContactDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firstContactDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Remind When to Contact Next</label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary !px-3 !py-2 !text-xs !min-h-[34px]"
                      onClick={() => {
                        const next = new Date();
                        next.setDate(next.getDate() + 7);
                        setFormData({
                          ...formData,
                          nextFollowupDate: next.toISOString().slice(0, 10),
                        });
                      }}
                    >
                      Remind in 7 Days
                    </button>
                    <input
                      type="date"
                      min={todayInput()}
                      value={formData.nextFollowupDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nextFollowupDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>City *</label>
                  <OptionAutocomplete
                    value={formData.city}
                    onChange={(value) =>
                      setFormData({
                        ...formData,
                        city: value,
                      })
                    }
                    options={cityOptions}
                    placeholder="Select city"
                    className="w-full"
                  />
                </div>
                <div className="form-group">
                  <label>Area</label>
                  <input
                    type="text"
                    value={formData.area}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        area: e.target.value,
                      })
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="form-group">
                  <label>Location / Landmark</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label>Interested Hoardings</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedHoardings.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold"
                      >
                        {code}
                        <button
                          type="button"
                          onClick={() => handleRemoveHoarding(code)}
                          className="text-sky-500 hover:text-sky-700 font-bold ml-0.5"
                          style={{ fontSize: "14px", lineHeight: "1" }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {selectedHoardings.length === 0 && (
                      <span className="text-xs text-slate-400 italic">No hoardings selected yet.</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchModalOpen(true);
                        setModalFilters({
                          code: "",
                          city: "",
                          area: "",
                          landmark: "",
                          type: "",
                          size: "",
                          availability: "",
                        });
                        setTimeout(() => loadModalHoardings(1), 50);
                      }}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition"
                    >
                      🔍 Search & Select Hoardings
                    </button>
                  </div>
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
              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: 12 }}
                disabled={!!phoneConflictMessage}
              >
                Save Inquiry
              </button>
            </form>
          </div>
        )}

        <style jsx global>{`
          .enquiry-create-form {
            padding: 16px 18px;
          }
          .enquiry-create-form:hover {
            transform: none;
          }
          .enquiry-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px 14px;
          }
          .enquiry-create-form .form-group {
            margin-bottom: 0;
          }
          .enquiry-create-form .form-group label {
            margin-bottom: 4px;
            font-size: 13px;
          }
          .enquiry-create-form .form-group input,
          .enquiry-create-form .form-group select,
          .enquiry-create-form .form-group textarea {
            padding: 8px 12px;
          }
          .enquiry-new-category {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 8px;
          }
          .enquiry-new-category input {
            flex: 1;
            min-width: 0;
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            font-size: 14px;
          }
          .enquiry-new-category .btn {
            padding: 8px 12px;
            min-height: 36px;
          }
          @media (max-width: 720px) {
            .enquiry-form-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0 }}>All Inquiries</h3>
            <div className="flex flex-wrap gap-2 w-full mobile-page-header-actions">
              <input
                type="text"
                placeholder="Search client, company or phone"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="h-10 w-[280px] max-w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              />
              <OptionAutocomplete
                value={filters.city}
                onChange={(value) => setFilters({ ...filters, city: value })}
                options={cityOptions}
                placeholder="City"
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
              <StatusDropdown
                value={filters.performanceStage}
                onChange={(v) =>
                  setFilters({ ...filters, performanceStage: v })
                }
                placeholder="All Funnel Stages"
                options={performanceStageOptions}
                buttonClassName="w-[190px]"
              />
              <StatusDropdown
                value={filters.categoryId}
                onChange={(v) => setFilters({ ...filters, categoryId: v })}
                placeholder="All Categories"
                options={[
                  { value: "", label: "All Categories" },
                  ...categoryOptions,
                ]}
                buttonClassName="w-[170px]"
              />
              {isOwnerOrManager ? (
                <select
                  value={filters.assignedSalesId}
                  onChange={(e) =>
                    setFilters({ ...filters, assignedSalesId: e.target.value })
                  }
                  className="h-10 w-[180px] rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="">All Sales</option>
                  {salesUsers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {isSalesRole ? (
                <label className="h-10 inline-flex items-center gap-2 px-3 rounded-md border border-slate-300 bg-white text-sm">
                  <input
                    type="checkbox"
                    checked={!!filters.assignedToMe}
                    onChange={(e) =>
                      setFilters({ ...filters, assignedToMe: e.target.checked })
                    }
                  />
                  Assigned to me
                </label>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "16px" }}>Loading...</div>
          ) : inquiries.length > 0 ? (
            <div
              className="mobile-scroll-card"
              style={{ marginTop: "16px", overflowX: "auto", width: "100%" }}
            >
              <table
                className="table"
                style={{ marginTop: 0, minWidth: "1900px" }}
              >
                <thead>
                  <tr>
                    <th>Phone</th>
                    <th>Client Name</th>
                    <th>Company Name</th>
                    <th>City</th>
                    <th>Area</th>
                    <th>Location</th>
                    <th>Interested Hoardings</th>
                    <th>First Contact</th>
                    <th>Next Follow-up</th>
                    <th>Follow-up</th>
                    <th>Category</th>
                    <th>Assigned Sales</th>
                    <th>Status</th>
                    <th>Funnel Stage</th>
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
                    const salesCanEdit =
                      isSalesRole &&
                      canUpdateInquiry &&
                      String(inquiry?.assignedSalesId || "") ===
                        String((user as any)?.id || "");
                    return (
                      <tr key={inquiry.id}>
                        <td>{inquiry.phone}</td>
                        <td>{inquiry.clientName}</td>
                        <td>{inquiry.companyName || "-"}</td>
                        <td>{inquiry.city}</td>
                        <td>{inquiry.area}</td>
                        <td>{inquiry.location}</td>
                        <td>
                          {inquiry.interestedHoardings ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {inquiry.interestedHoardings.split(",").map((h: string) => (
                                <span
                                  key={h}
                                  className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold border border-sky-200"
                                >
                                  {h}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          {inquiry.firstContactDate
                            ? new Date(
                                inquiry.firstContactDate,
                              ).toLocaleDateString()
                            : "-"}
                        </td>
                        <td>
                          {inquiry.nextFollowupDate
                            ? new Date(
                                inquiry.nextFollowupDate,
                              ).toLocaleDateString()
                            : "-"}
                        </td>
                        <td>{inquiry.followupStatus || "PENDING"}</td>
                        <td>{inquiry?.category?.name || "-"}</td>
                        <td>
                          {isOwnerOrManager ? (
                            <select
                              value={String(inquiry?.assignedSalesId || "")}
                              onChange={(e) =>
                                assignSales(String(inquiry.id), e.target.value)
                              }
                            >
                              <option value="">Unassigned</option>
                              {salesUsers.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            inquiry?.assignedSales?.name || "Unassigned"
                          )}
                        </td>
                        <td>{inquiry.status}</td>
                        <td>
                          {isSalesRole ? (
                            salesCanEdit ? (
                              <StatusDropdown
                                value={String(
                                  inquiry.performanceStage || "IN_PROCESS",
                                )}
                                onChange={(v) =>
                                  handleUpdatePerformanceStage(inquiry.id, v)
                                }
                                placeholder={String(
                                  inquiry.performanceStage || "IN_PROCESS",
                                )}
                                options={performanceStageOptions.filter(
                                  (o) => o.value !== "",
                                )}
                                buttonClassName="w-[180px]"
                              />
                            ) : (
                              <StatusDropdown
                                value={String(
                                  inquiry.performanceStage || "IN_PROCESS",
                                )}
                                onChange={() => {}}
                                placeholder={String(
                                  inquiry.performanceStage || "IN_PROCESS",
                                )}
                                options={performanceStageOptions.filter(
                                  (o) => o.value !== "",
                                )}
                                buttonClassName="w-[180px]"
                                disabled
                              />
                            )
                          ) : canUpdateInquiry ? (
                            <StatusDropdown
                              value={String(
                                inquiry.performanceStage || "IN_PROCESS",
                              )}
                              onChange={(v) =>
                                handleUpdatePerformanceStage(inquiry.id, v)
                              }
                              placeholder={String(
                                inquiry.performanceStage || "IN_PROCESS",
                              )}
                              options={performanceStageOptions.filter(
                                (o) => o.value !== "",
                              )}
                              buttonClassName="w-[180px]"
                            />
                          ) : (
                            <span>
                              {inquiry.performanceStage || "IN_PROCESS"}
                            </span>
                          )}
                        </td>
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
                            salesCanEdit ? (
                              <StatusDropdown
                                value={String(inquiry.status || "")}
                                onChange={(v) =>
                                  handleUpdateStatus(inquiry.id, v)
                                }
                                placeholder={String(inquiry.status || "Status")}
                                options={statusOptions.filter(
                                  (o) => o.value !== "",
                                )}
                              />
                            ) : (
                              <StatusDropdown
                                value={String(inquiry.status || "")}
                                onChange={() => {}}
                                placeholder={String(inquiry.status || "Status")}
                                options={statusOptions.filter(
                                  (o) => o.value !== "",
                                )}
                                disabled
                              />
                            )
                          ) : canUpdateInquiry ? (
                            <StatusDropdown
                              value={String(inquiry.status || "")}
                              onChange={(v) =>
                                handleUpdateStatus(inquiry.id, v)
                              }
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
            </div>
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
            <div
              className="mobile-stack-row"
              style={{ marginTop: "16px", display: "flex", gap: "8px" }}
            >
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

      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between bg-slate-50 text-slate-800">
              <h3 className="text-lg font-semibold">🔍 Advanced Hoarding Search</h3>
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="text-slate-500 hover:text-slate-700 text-2xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Filters */}
            <div className="p-4 border-b bg-slate-50/50 grid grid-cols-1 sm:grid-cols-4 gap-3 text-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Code / Keyword</label>
                <input
                  type="text"
                  value={modalFilters.code}
                  onChange={(e) => setModalFilters(p => ({ ...p, code: e.target.value }))}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                  placeholder="Search code..."
                />
              </div>
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1">City</label>
                <OptionAutocomplete
                  value={modalFilters.city}
                  onChange={(val) => setModalFilters(p => ({ ...p, city: val, area: "", landmark: "" }))}
                  options={cityOptions}
                  placeholder="Select city"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-400/30 bg-white"
                />
              </div>
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Area
                </label>
                <OptionAutocomplete
                  value={modalFilters.area}
                  onChange={(val) => setModalFilters(p => ({ ...p, area: val }))}
                  options={filteredAreaOptions}
                  placeholder="Search area..."
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-400/30 bg-white"
                />
              </div>
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Landmark
                </label>
                <OptionAutocomplete
                  value={modalFilters.landmark}
                  onChange={(val) => setModalFilters(p => ({ ...p, landmark: val }))}
                  options={filteredLandmarkOptions}
                  placeholder="Select landmark"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-400/30 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                <StatusDropdown
                  value={modalFilters.type}
                  onChange={(val) => setModalFilters(p => ({ ...p, type: val }))}
                  placeholder="All Types"
                  matchButtonWidth
                  buttonClassName="w-full text-xs"
                  options={[
                    { value: "", label: "All Types" },
                    { value: "Lit", label: "Lit" },
                    { value: "Non-Lit", label: "Non-Lit" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Size</label>
                <StatusDropdown
                  value={modalFilters.size}
                  onChange={(val) => setModalFilters(p => ({ ...p, size: val }))}
                  placeholder="Any Size"
                  matchButtonWidth
                  buttonClassName="w-full text-xs"
                  options={[
                    { value: "", label: "Any Size" },
                    { value: "10x20", label: "10x20" },
                    { value: "10x30", label: "10x30" },
                    { value: "10x40", label: "10x40" },
                    { value: "12x24", label: "12x24" },
                    { value: "20x40", label: "20x40" },
                    { value: "20x50", label: "20x50" },
                    { value: "30x40", label: "30x40" },
                    { value: "30x60", label: "30x60" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Availability</label>
                <StatusDropdown
                  value={modalFilters.availability}
                  onChange={(val) => setModalFilters(p => ({ ...p, availability: val }))}
                  placeholder="All Status"
                  matchButtonWidth
                  buttonClassName="w-full text-xs"
                  options={[
                    { value: "", label: "All Status" },
                    { value: "available", label: "Available" },
                    { value: "occupied", label: "Occupied" },
                    { value: "blocked", label: "Blocked" },
                    { value: "booked", label: "Booked" },
                    { value: "under_process", label: "Under Process" },
                    { value: "live", label: "Live" },
                  ]}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => loadModalHoardings(1)}
                  className="flex-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalFilters({
                      code: "",
                      city: "",
                      area: "",
                      landmark: "",
                      type: "",
                      size: "",
                      availability: "",
                    });
                    loadModalHoardings(1);
                  }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Modal Results */}
            <div className="flex-1 overflow-auto p-4 text-slate-800">
              {modalLoading ? (
                <div className="text-center py-8 text-sm">Searching...</div>
              ) : modalHoardings.length > 0 ? (
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-600 uppercase font-semibold">
                      <th className="p-2 text-center w-12">Select</th>
                      <th className="p-2">Code</th>
                      <th className="p-2">City</th>
                      <th className="p-2">Area / Location</th>
                      <th className="p-2">Landmark</th>
                      <th className="p-2">Dimensions</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalHoardings.map((h: any) => {
                      const isSelected = selectedHoardings.includes(h.code);
                      return (
                        <tr key={h.id} className="border-b hover:bg-slate-50/50">
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleModalHoarding(h)}
                              className="accent-sky-600"
                            />
                          </td>
                          <td className="p-2 font-semibold text-slate-900">{h.code}</td>
                          <td className="p-2">{h.city || "—"}</td>
                          <td className="p-2">{h.area || "—"}</td>
                          <td className="p-2">{h.landmark || "—"}</td>
                          <td className="p-2">
                            {h.widthCm && h.heightCm
                              ? `${Math.round(h.widthCm / 30.48)}ft x ${Math.round(h.heightCm / 30.48)}ft`
                              : "—"}
                          </td>
                          <td className="p-2">{h.type || "—"}</td>
                          <td className="p-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              String(h.status).toLowerCase() === "available" ? "bg-emerald-100 text-emerald-800" :
                              String(h.status).toLowerCase() === "booked" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                            }`}>
                              {String(h.status).toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-sm text-slate-500">No hoardings found. Try broadening your filters.</div>
              )}
            </div>

            {/* Modal Pagination / Footer */}
            <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Page <strong>{modalPage}</strong> of {Math.max(1, Math.ceil(modalTotal / MODAL_PAGE_SIZE))} · {modalTotal} result(s)
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => loadModalHoardings(Math.max(1, modalPage - 1))}
                  disabled={modalLoading || modalPage <= 1}
                  className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-white disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => loadModalHoardings(Math.min(Math.ceil(modalTotal / MODAL_PAGE_SIZE), modalPage + 1))}
                  disabled={modalLoading || modalPage >= Math.ceil(modalTotal / MODAL_PAGE_SIZE)}
                  className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-white disabled:opacity-50"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => setIsSearchModalOpen(false)}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition ml-4"
                >
                  Done ({selectedHoardings.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
