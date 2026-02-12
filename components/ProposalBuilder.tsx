"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { categoriesAPI, clientsAPI, hoardingsAPI, proposalsAPI } from "@/lib/api";
import AccessDenied from "@/components/AccessDenied";
import { getRoleFromUser } from "@/lib/rbac";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { showError, showInfo, showSuccess } from "@/lib/toast";

type ProposalMode = "WITH_RATE" | "WITHOUT_RATE";
type ProposalDiscountType = "FLAT" | "PERCENT";

type ClientRow = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
};

type HoardingRow = {
  id: string;
  code?: string | null;
  city?: string | null;
  area?: string | null;
  landmark?: string | null;
  roadName?: string | null;
  side?: string | null;
  title?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  type?: string | null;
  status?: string | null;
  standardRate?: string | number | null;
  minimumRate?: string | number | null;
  baseRate?: string | number | null;
  illumination?: boolean | null;
  illuminationCost?: string | number | null;
};

type SelectedHoarding = {
  hoardingId: string;
  hoardingCode?: string | null;
  baseRate: number;
  minimumRate: number;
  city?: string | null;
  area?: string | null;
  location?: string | null;
  sizeLabel?: string | null;
  type?: string | null;
  status?: string | null;
  discountPct: number;
  illumination: boolean;
  illuminationCost: number;
};

const toFtLabel = (widthCm?: number | null, heightCm?: number | null) => {
  if (!widthCm || !heightCm) return "—";
  return `${Math.round(widthCm / 30.48)}ft x ${Math.round(heightCm / 30.48)}ft`;
};

const toMoney = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return n;
};

const standardRateOf = (h: Partial<HoardingRow>) =>
  Math.max(0, toMoney(h.standardRate ?? h.baseRate));

const minimumRateOf = (h: Partial<HoardingRow>) =>
  Math.max(0, toMoney(h.minimumRate ?? 0));

const clampPctLocal = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const locationLabel = (h: HoardingRow) => {
  return (
    [h.title, h.landmark, h.roadName, h.side]
      .map((x) => (x == null ? "" : String(x).trim()))
      .filter(Boolean)
      .slice(0, 3)
      .join(", ") || "—"
  );
};

const isSelectionDisabledStatus = (status?: string | null) => {
  const s = String(status || "")
    .toLowerCase()
    .trim();
  return s === "booked" || s === "blocked" || s === "live";
};

// Must match backend computeLineFinalRate() exactly.
const computeFinalRate = (args: {
  baseRate: number;
  discountPct: number;
  illuminationCost: number;
}) => {
  const discounted = args.baseRate * (1 - args.discountPct / 100);
  return discounted + args.illuminationCost;
};

const computeProposalPricing = (args: {
  subtotal: number;
  discountType: ProposalDiscountType;
  discountValue: number;
  includeGst: boolean;
  gstRatePct: number;
  printingCharges: number;
  mountingCharges: number;
}) => {
  const subtotal = Math.max(0, args.subtotal);
  const discountValue = Math.max(0, args.discountValue);
  const discountAmount =
    args.discountType === "FLAT"
      ? Math.min(subtotal, discountValue)
      : subtotal * (Math.min(100, discountValue) / 100);
  const finalWithoutGst = Math.max(0, subtotal - discountAmount);
  const preGstWithCharges =
    finalWithoutGst +
    Math.max(0, args.printingCharges) +
    Math.max(0, args.mountingCharges);
  const gstAmount = args.includeGst
    ? preGstWithCharges * (clampPctLocal(args.gstRatePct) / 100)
    : 0;
  const finalWithGst = preGstWithCharges + gstAmount;
  const grandTotal = finalWithGst;
  return {
    subtotal,
    discountAmount,
    finalWithoutGst,
    gstAmount,
    finalWithGst,
    grandTotal,
  };
};

const SIZE_PRESETS = [
  "10x20",
  "10x30",
  "10x40",
  "12x24",
  "20x40",
  "20x50",
  "30x40",
  "30x60",
];

const AVAILABILITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "available", label: "Immediately Available" },
  { value: "available_free", label: "Available (not blocked by me)" },
  { value: "available_soon", label: "Available Soon" },
  { value: "blocked", label: "Blocked" },
  { value: "booked", label: "Booked" },
  { value: "under_process", label: "Under Process" },
  { value: "on_rent", label: "On Rent" },
  { value: "", label: "All" },
];

export default function ProposalBuilder({
  proposalId,
}: {
  proposalId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const roleName = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = localStorage.getItem("user");
      const user = raw ? JSON.parse(raw) : null;
      return String(getRoleFromUser(user) || "").toLowerCase();
    } catch {
      return "";
    }
  }, []);

  const [mode, setMode] = useState<ProposalMode>("WITH_RATE");
  const [proposalDate, setProposalDate] = useState<string>("");
  const [discountType, setDiscountType] =
    useState<ProposalDiscountType>("PERCENT");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number>(0);
  const [printingCharges, setPrintingCharges] = useState<number>(0);
  const [mountingCharges, setMountingCharges] = useState<number>(0);
  const [includeGst, setIncludeGst] = useState<boolean>(false);
  const [gstRatePct, setGstRatePct] = useState<number>(18);

  const [activeProposalId, setActiveProposalId] = useState<string>(
    proposalId || "",
  );
  const [pdfReadyProposalId, setPdfReadyProposalId] = useState<string>("");

  // Smart client search + select
  const [clientInput, setClientInput] = useState<string>("");
  const [clientSuggestions, setClientSuggestions] = useState<ClientRow[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);

  const clientInputRef = useRef<HTMLInputElement | null>(null);
  const clientDropdownRef = useRef<HTMLDivElement | null>(null);
  const [clientDropdownRect, setClientDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const [filters, setFilters] = useState({
    city: "",
    area: "",
    categoryId: "",
    location: "",
    type: "",
    size: "",
    availability: "",
  });
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const [hoardings, setHoardings] = useState<HoardingRow[]>([]);
  const [total, setTotal] = useState<number>(0);

  const [selected, setSelected] = useState<SelectedHoarding[]>([]);

  const persistDraftToLocal = () => {
    try {
      const payload = {
        v: 1,
        mode,
        proposalDate,
        discountType,
        discountValue,
        globalDiscountPct,
        printingCharges,
        mountingCharges,
        includeGst,
        gstRatePct,
        filters,
        page,
        limit,
        selected,
        activeProposalId,
      };
      localStorage.setItem("proposalBuilderDraft", JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const restoreDraftFromLocal = () => {
    try {
      const raw = localStorage.getItem("proposalBuilderDraft");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1) return;
      if (parsed.mode) setMode(parsed.mode);
      if (typeof parsed.proposalDate === "string")
        setProposalDate(parsed.proposalDate);
      if (parsed.discountType === "FLAT" || parsed.discountType === "PERCENT") {
        setDiscountType(parsed.discountType);
      }
      if (typeof parsed.discountValue === "number")
        setDiscountValue(parsed.discountValue);
      if (typeof parsed.globalDiscountPct === "number")
        setGlobalDiscountPct(parsed.globalDiscountPct);
      if (typeof parsed.printingCharges === "number")
        setPrintingCharges(parsed.printingCharges);
      if (typeof parsed.mountingCharges === "number")
        setMountingCharges(parsed.mountingCharges);
      if (typeof parsed.includeGst === "boolean")
        setIncludeGst(parsed.includeGst);
      if (typeof parsed.gstRatePct === "number")
        setGstRatePct(parsed.gstRatePct);
      if (parsed.filters) setFilters(parsed.filters);
      if (typeof parsed.page === "number") setPage(parsed.page);
      if (typeof parsed.limit === "number") setLimit(parsed.limit);
      if (Array.isArray(parsed.selected)) setSelected(parsed.selected);
      if (
        typeof parsed.activeProposalId === "string" &&
        parsed.activeProposalId
      )
        setActiveProposalId(parsed.activeProposalId);
    } catch {
      // ignore
    }
  };

  const selectedSet = useMemo(
    () => new Set(selected.map((s) => s.hoardingId)),
    [selected],
  );

  const normalizedClientInput = useMemo(
    () => clientInput.trim(),
    [clientInput],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (proposalDate) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setProposalDate(`${yyyy}-${mm}-${dd}`);
  }, [proposalDate]);

  const updateClientDropdownRect = () => {
    const el = clientInputRef.current;
    if (!el) {
      setClientDropdownRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setClientDropdownRect({
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
    });
  };

  useLayoutEffect(() => {
    if (!clientDropdownOpen) return;
    updateClientDropdownRect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientDropdownOpen, clientInput]);

  useEffect(() => {
    if (!clientDropdownOpen) return;

    const onScroll = () => updateClientDropdownRect();
    const onResize = () => updateClientDropdownRect();
    // Capture scroll events from any scroll container.
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientDropdownOpen]);

  useEffect(() => {
    if (!clientDropdownOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClientDropdownOpen(false);
    };

    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      const inputEl = clientInputRef.current;
      const dropEl = clientDropdownRef.current;
      if (inputEl?.contains(t)) return;
      if (dropEl?.contains(t)) return;
      setClientDropdownOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [clientDropdownOpen]);

  const totals = useMemo(() => {
    if (mode === "WITHOUT_RATE") {
      return {
        subtotal: 0,
        discountAmount: 0,
        finalWithoutGst: 0,
        gstAmount: 0,
        finalWithGst: 0,
        grandTotal: Math.max(0, printingCharges) + Math.max(0, mountingCharges),
      };
    }

    let subtotal = 0;
    for (const s of selected) {
      const final = computeFinalRate({
        baseRate: s.baseRate,
        discountPct: clampPctLocal(s.discountPct),
        illuminationCost: s.illumination ? Math.max(0, s.illuminationCost) : 0,
      });
      subtotal += Math.max(0, final);
    }

    return computeProposalPricing({
      subtotal,
      discountType,
      discountValue,
      includeGst,
      gstRatePct,
      printingCharges,
      mountingCharges,
    });
  }, [
    selected,
    mode,
    discountType,
    discountValue,
    includeGst,
    gstRatePct,
    printingCharges,
    mountingCharges,
  ]);

  // Debounced client search
  useEffect(() => {
    if (roleName && roleName !== "sales") return;
    const q = normalizedClientInput;
    if (!q || q.length < 2) {
      setClientSuggestions([]);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setClientSearching(true);
      try {
        const resp = await clientsAPI.search(q, 10);
        const rows = (resp?.data || []) as ClientRow[];
        if (!cancelled) setClientSuggestions(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setClientSuggestions([]);
      } finally {
        if (!cancelled) setClientSearching(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [normalizedClientInput, roleName]);

  const loadHoardings = async (nextPage: number) => {
    setLoading(true);
    try {
      const resp = await hoardingsAPI.getAll({
        page: nextPage,
        limit,
        city: filters.city || undefined,
        area: filters.area || undefined,
        categoryId: filters.categoryId || undefined,
        location: filters.location || undefined,
        type: filters.type || undefined,
        size: filters.size || undefined,
        availability: filters.availability || undefined,
      });
      const payload = resp?.data || {};
      setHoardings(Array.isArray(payload.hoardings) ? payload.hoardings : []);
      setTotal(Number(payload.total || 0));
      setPage(Number(payload.page || nextPage));
    } catch {
      setHoardings([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (roleName && roleName !== "sales") return;
    loadHoardings(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleName]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await categoriesAPI.list();
        setCategories(Array.isArray(res?.data) ? res.data : []);
      } catch {
        setCategories([]);
      }
    };
    loadCategories();
  }, []);

  // Auto-apply filters (debounced)
  useEffect(() => {
    if (roleName && roleName !== "sales") return;
    const t = setTimeout(() => {
      setPage(1);
      loadHoardings(1);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roleName,
    filters.city,
    filters.area,
    filters.categoryId,
    filters.location,
    filters.type,
    filters.size,
    filters.availability,
  ]);

  // Hydrate from return-to flow: /clients/new redirects back with ?clientId=
  useEffect(() => {
    if (roleName && roleName !== "sales") return;
    // When returning from client creation, restore any saved builder state.
    if (!proposalId) restoreDraftFromLocal();

    const cid = searchParams?.get("clientId");
    if (!cid) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await clientsAPI.getById(String(cid));
        const c = resp?.data as ClientRow | undefined;
        if (!cancelled && c?.id) {
          setSelectedClient(c);
          setClientInput(`${c.name}${c.phone ? ` (${c.phone})` : ""}`);
          try {
            localStorage.removeItem("proposalBuilderDraft");
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, roleName]);

  // If editing an existing proposal, load it and prefill everything.
  useEffect(() => {
    if (roleName && roleName !== "sales") return;
    if (!proposalId) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await proposalsAPI.getById(String(proposalId));
        const p = resp?.data;
        if (!p || cancelled) return;
        setActiveProposalId(String(p.id || proposalId));
        setMode((p.mode as ProposalMode) || "WITH_RATE");
        if (p.proposalDate) {
          const d = new Date(p.proposalDate);
          if (!Number.isNaN(d.getTime())) {
            setProposalDate(d.toISOString().slice(0, 10));
          }
        }
        setDiscountType(
          String(p.discountType || "PERCENT").toUpperCase() === "FLAT"
            ? "FLAT"
            : "PERCENT",
        );
        setDiscountValue(toMoney(p.discountValue ?? 0));
        setGlobalDiscountPct(Number(p.globalDiscountPct ?? 0));
        setPrintingCharges(toMoney(p.printingCharges ?? 0));
        setMountingCharges(toMoney(p.mountingCharges ?? 0));
        setIncludeGst(!!p.includeGst);
        setGstRatePct(Number(p.gstRatePct ?? 18));
        if (p.client?.id) {
          const c: ClientRow = {
            id: String(p.client.id),
            name: String(p.client.name || ""),
            phone: p.client.phone ?? null,
            email: p.client.email ?? null,
            companyName: p.client.companyName ?? null,
          };
          setSelectedClient(c);
          setClientInput(`${c.name}${c.phone ? ` (${c.phone})` : ""}`);
        }
        const rows = Array.isArray(p.hoardings) ? p.hoardings : [];
        setSelected(
          rows
            .filter((h: any) => !!h?.hoardingId)
            .map((h: any) => ({
              hoardingId: String(h.hoardingId),
              hoardingCode: h.hoardingCode ?? null,
              baseRate: Math.max(0, toMoney(h.baseRate)),
              minimumRate: 0,
              city: h.city ?? null,
              area: h.area ?? null,
              location: h.location ?? null,
              sizeLabel: h.sizeLabel ?? null,
              type: h.type ?? null,
              status: h.hoarding?.status ?? null,
              discountPct: toMoney(h.discountPct),
              illumination: !!h.illumination,
              illuminationCost: toMoney(h.illuminationCost),
            })),
        );
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposalId, roleName]);

  const resetFilters = () => {
    setFilters({
      city: "",
      area: "",
      categoryId: "",
      location: "",
      type: "",
      size: "",
      availability: "",
    });
    setPage(1);
    loadHoardings(1);
  };

  const selectAllVisibleImmediatelyAvailable = () => {
    if (filters.availability !== "available") return;
    setSelected((prev) => {
      const byId = new Map(prev.map((x) => [x.hoardingId, x]));
      for (const h of hoardings) {
        if (!h?.id || isSelectionDisabledStatus(h.status)) continue;
        if (!byId.has(h.id)) {
          byId.set(h.id, {
            hoardingId: h.id,
            hoardingCode: h.code,
            baseRate: standardRateOf(h),
            minimumRate: minimumRateOf(h),
            city: h.city ?? null,
            area: h.area ?? null,
            location: locationLabel(h),
            sizeLabel: toFtLabel(h.widthCm, h.heightCm),
            type: h.type ?? null,
            status: h.status ?? null,
            discountPct: 0,
            illumination: false,
            illuminationCost: 0,
          });
        }
      }
      return Array.from(byId.values());
    });
  };

  const selectClient = (c: ClientRow) => {
    setSelectedClient(c);
    setClientInput(`${c.name}${c.phone ? ` (${c.phone})` : ""}`);
    setClientDropdownOpen(false);
    setClientSuggestions([]);
  };

  const goToCreateClient = () => {
    const q = normalizedClientInput;
    if (!q) return;

    // Preserve in-progress proposal selection & pricing.
    persistDraftToLocal();

    const digits = q.replace(/\D/g, "");
    const isLikelyPhone = digits.length >= 6 && digits.length === q.length;
    const prefillPhone = isLikelyPhone ? digits : "";
    const prefillName = isLikelyPhone ? "" : q;
    const returnTo = pathname || "/proposals/create";
    const url =
      `/clients/new?returnTo=${encodeURIComponent(returnTo)}` +
      `&prefillName=${encodeURIComponent(prefillName)}` +
      `&prefillPhone=${encodeURIComponent(prefillPhone)}`;
    router.push(url);
  };

  const toggleSelect = (h: HoardingRow) => {
    if (isSelectionDisabledStatus(h.status)) return;
    const baseRate = standardRateOf(h);
    const minimumRate = minimumRateOf(h);
    setSelected((prev) => {
      const exists = prev.find((p) => p.hoardingId === h.id);
      if (exists) return prev.filter((p) => p.hoardingId !== h.id);
      return [
        ...prev,
        {
          hoardingId: h.id,
          hoardingCode: h.code,
          baseRate,
          minimumRate,
          city: h.city ?? null,
          area: h.area ?? null,
          location: locationLabel(h),
          sizeLabel: toFtLabel(h.widthCm, h.heightCm),
          type: h.type ?? null,
          status: h.status ?? null,
          discountPct: 0,
          illumination: false,
          illuminationCost: 0,
        },
      ];
    });
  };

  const updateSelected = (
    hoardingId: string,
    patch: Partial<
      Pick<
        SelectedHoarding,
        "discountPct" | "illumination" | "illuminationCost"
      >
    >,
  ) => {
    setSelected((prev) =>
      prev.map((s) => (s.hoardingId === hoardingId ? { ...s, ...patch } : s)),
    );
  };

  const validatePricing = (): string | null => {
    if (!proposalDate) return "Select proposal date";
    if (mode === "WITH_RATE") {
      for (const s of selected) {
        const line = computeFinalRate({
          baseRate: Math.max(0, s.baseRate),
          discountPct: clampPctLocal(s.discountPct),
          illuminationCost: s.illumination ? Math.max(0, s.illuminationCost) : 0,
        });
        if (line < Math.max(0, s.minimumRate || 0)) {
          return `Final rate for ${s.hoardingCode || "selected hoarding"} cannot be below minimum rate`;
        }
      }
    }
    return null;
  };

  const getClientPayload = () => {
    if (!selectedClient) return null;
    if (!selectedClient.phone) return null;
    return {
      name: selectedClient.name,
      phone: String(selectedClient.phone),
      email: selectedClient.email || undefined,
      companyName: selectedClient.companyName || undefined,
    };
  };

  const createOrUpdateDraft = async () => {
    const client = getClientPayload();
    if (!client) {
      alert("Select a client");
      return null;
    }
    if (selected.length === 0) {
      alert("Select at least 1 hoarding");
      return null;
    }

    const pricingError = validatePricing();
    if (pricingError) {
      alert(pricingError);
      return null;
    }

    setSaving(true);
    try {
      const payload = {
        client,
        proposalDate,
        mode,
        discountType,
        discountValue: Math.max(0, toMoney(discountValue)),
        globalDiscountPct: clampPctLocal(globalDiscountPct),
        printingCharges: Math.max(0, toMoney(printingCharges)),
        mountingCharges: Math.max(0, toMoney(mountingCharges)),
        includeGst,
        gstRatePct: clampPctLocal(gstRatePct),
        hoardings: selected.map((s) => ({
          hoardingId: s.hoardingId,
          discountPct: clampPctLocal(s.discountPct),
          illumination: s.illumination,
          illuminationCost: Math.max(0, s.illuminationCost),
        })),
      };

      if (activeProposalId) {
        const resp = await proposalsAPI.updateDraft(
          String(activeProposalId),
          payload,
        );
        const id = resp?.data?.id as string | undefined;
        if (id) setActiveProposalId(String(id));
        return id || activeProposalId || null;
      }

      const resp = await proposalsAPI.createDraft(payload);
      const id = resp?.data?.id as string | undefined;
      if (id) setActiveProposalId(String(id));
      return id || null;
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to create proposal");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    const id = await createOrUpdateDraft();
    if (id) router.push(`/proposals/${id}/edit`);
  };

  const handleGeneratePdf = async () => {
    setActing(true);
    try {
      const id = await createOrUpdateDraft();
      if (!id) return;

      const selectedBeforeGenerate = [...selected];

      // Generate + store PDF but keep proposal as DRAFT (not SENT)
      await proposalsAPI.generatePdf(String(id));

      // Re-fetch proposal to detect rows excluded by booked/blocked re-validation.
      const fresh = await proposalsAPI.getById(String(id));
      const latestRows = Array.isArray(fresh?.data?.hoardings)
        ? fresh.data.hoardings
        : [];
      const keptIds = new Set(
        latestRows.map((r: any) => String(r?.hoardingId || "")).filter(Boolean),
      );
      const excluded = selectedBeforeGenerate.filter(
        (s) => !keptIds.has(String(s.hoardingId || "")),
      );

      if (excluded.length > 0) {
        const sampleCodes = excluded
          .map((x) => x.hoardingCode)
          .filter(Boolean)
          .slice(0, 3)
          .join(", ");
        const suffix =
          excluded.length > 3 ? ` and ${excluded.length - 3} more` : "";
        showInfo(
          `${excluded.length} hoarding(s) were excluded because they are booked/blocked.${sampleCodes ? ` (${sampleCodes}${suffix})` : ""}`,
        );
      } else {
        showSuccess("PDF generated. All selected hoardings are available.");
      }

      // Keep UI selection in sync with what remains in proposal after re-validation.
      setSelected((prev) =>
        prev.filter((s) => keptIds.has(String(s.hoardingId))),
      );

      // Download (will serve stored PDF)
      const resp = await proposalsAPI.downloadPdf(String(id));
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposal-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setPdfReadyProposalId(String(id));
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to generate PDF");
    } finally {
      setActing(false);
    }
  };

  if (roleName && roleName !== "sales") {
    return <AccessDenied />;
  }

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Proposal Builder
            </h1>
            <div className="text-sm text-white/80">
              Filter hoardings, apply controlled pricing, and generate a
              structured PDF.
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/proposals"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-white/30 bg-white/10 text-white hover:bg-white/15 backdrop-blur"
            >
              Proposals
            </Link>
            <button
              onClick={handleSaveDraft}
              disabled={saving || acting || !proposalDate}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-white/30 bg-white/10 text-white hover:bg-white/15 backdrop-blur disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={handleGeneratePdf}
              disabled={saving || acting || !proposalDate}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
            >
              {acting ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>

        {pdfReadyProposalId ? (
          <div className="mb-5 bg-emerald-50/90 border border-emerald-200 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 backdrop-blur">
            <div className="text-sm text-emerald-900">
              <div className="font-semibold">
                Proposal generated successfully.
              </div>
              <div className="text-emerald-800">
                You can finalize hoardings now or later.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  router.push(`/proposals/${pdfReadyProposalId}/finalize`)
                }
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              >
                Finalize Hoardings
              </button>
              <button
                type="button"
                onClick={() => router.push("/proposals")}
                className="px-4 py-2.5 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-900"
              >
                Later
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-6 lg:max-h-[calc(100vh-140px)] lg:overflow-auto lg:pr-1">
              <div className="bg-white/95 backdrop-blur rounded-2xl border border-white/30 shadow-lg p-4 text-slate-900 relative z-40 overflow-visible">
                <h2 className="font-semibold mb-3 text-slate-900">Client</h2>
                <div className="relative">
                  <input
                    placeholder="Type client name or phone"
                    value={clientInput}
                    onChange={(e) => {
                      setClientInput(e.target.value);
                      setSelectedClient(null);
                      setClientDropdownOpen(true);
                    }}
                    onFocus={() => setClientDropdownOpen(true)}
                    ref={clientInputRef}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  />

                  {portalReady && clientDropdownOpen && clientDropdownRect
                    ? createPortal(
                        <div
                          ref={clientDropdownRef}
                          className="fixed z-[9999] bg-white border rounded shadow-sm max-h-64 overflow-auto"
                          style={{
                            top: clientDropdownRect.top,
                            left: clientDropdownRect.left,
                            width: clientDropdownRect.width,
                          }}
                        >
                          {clientSearching ? (
                            <div className="px-3 py-2 text-sm text-gray-600">
                              Searching...
                            </div>
                          ) : null}

                          {!clientSearching &&
                          clientSuggestions.length === 0 &&
                          normalizedClientInput ? (
                            <button
                              type="button"
                              onClick={goToCreateClient}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                            >
                              + Create new client “{normalizedClientInput}”
                            </button>
                          ) : null}

                          {clientSuggestions.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectClient(c)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                            >
                              <div className="font-medium">{c.name}</div>
                              <div className="text-xs text-gray-600">
                                {c.phone || "—"}
                              </div>
                            </button>
                          ))}
                        </div>,
                        document.body,
                      )
                    : null}
                </div>

                {selectedClient ? (
                  <div className="mt-2 text-xs text-gray-700 flex items-center justify-between">
                    <div>
                      Selected:{" "}
                      <span className="font-semibold">
                        {selectedClient.name}
                      </span>
                      {selectedClient.phone ? ` (${selectedClient.phone})` : ""}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClient(null);
                        setClientInput("");
                        setClientSuggestions([]);
                      }}
                      className="text-blue-700 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="bg-white/95 backdrop-blur rounded-2xl border border-white/30 shadow-lg p-4 text-slate-900 relative z-10">
                <h2 className="font-semibold mb-3 text-slate-900">
                  Proposal Settings
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">
                      Proposal Date *
                    </label>
                    <input
                      type="date"
                      value={proposalDate}
                      onChange={(e) => setProposalDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Mode
                    </label>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as ProposalMode)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                    >
                      <option value="WITH_RATE">With Rate</option>
                      <option value="WITHOUT_RATE">Without Rate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Discount Type
                    </label>
                    <select
                      value={discountType}
                      onChange={(e) =>
                        setDiscountType(
                          e.target.value === "FLAT" ? "FLAT" : "PERCENT",
                        )
                      }
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                    >
                      <option value="PERCENT">Percentage (%)</option>
                      <option value="FLAT">Flat (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Discount Value
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={discountType === "PERCENT" ? 100 : undefined}
                      value={discountValue}
                      onChange={(e) =>
                        setDiscountValue(
                          discountType === "PERCENT"
                            ? clampPctLocal(e.target.value)
                            : Math.max(0, toMoney(e.target.value)),
                        )
                      }
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Printing Charges
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={printingCharges}
                      onChange={(e) =>
                        setPrintingCharges(Math.max(0, toMoney(e.target.value)))
                      }
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Mounting Charges
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={mountingCharges}
                      onChange={(e) =>
                        setMountingCharges(Math.max(0, toMoney(e.target.value)))
                      }
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between border rounded px-3 py-2">
                    <label className="text-sm">With GST</label>
                    <input
                      type="checkbox"
                      checked={includeGst}
                      onChange={(e) => setIncludeGst(e.target.checked)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">
                      GST %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={gstRatePct}
                      onChange={(e) =>
                        setGstRatePct(clampPctLocal(e.target.value))
                      }
                      disabled={!includeGst}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 disabled:opacity-60"
                    />
                  </div>
                </div>

                {mode === "WITH_RATE" ? (
                  <div className="mt-3 rounded border bg-gray-50 p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span>{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-600">Discount</span>
                      <span>{totals.discountAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-600">Final Without GST</span>
                      <span>{totals.finalWithoutGst.toFixed(2)}</span>
                    </div>
                    {includeGst ? (
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-600">GST</span>
                        <span>{totals.gstAmount.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-600">Printing</span>
                      <span>{Math.max(0, printingCharges).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-600">Mounting</span>
                      <span>{Math.max(0, mountingCharges).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1 font-semibold">
                      <span>Grand Total</span>
                      <span>{totals.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-gray-600">
                    Rate fields are hidden in the PDF, but still stored
                    internally.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white/95 backdrop-blur rounded-2xl border border-white/30 shadow-lg p-4 text-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Hoarding Filters
                  </h2>
                  <div className="text-xs text-gray-600">
                    Only matching hoardings are shown.
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadHoardings(1)}
                    disabled={loading}
                    className="px-4 py-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 text-sm disabled:opacity-50"
                  >
                    {loading ? "Searching..." : "Search"}
                  </button>
                  <button
                    onClick={resetFilters}
                    className="px-4 py-0 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm"
                  >
                    Reset
                  </button>
                  {filters.availability === "available" ? (
                    <button
                      onClick={selectAllVisibleImmediatelyAvailable}
                      className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-sm text-blue-700"
                    >
                      Select All
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    City
                  </label>
                  <input
                    value={filters.city}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, city: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Area
                  </label>
                  <input
                    value={filters.area}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, area: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Category
                  </label>
                  <select
                    value={filters.categoryId}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, categoryId: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  >
                    <option value="">All</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Location
                  </label>
                  <LocationAutocomplete
                    value={filters.location}
                    onChange={(value) =>
                      setFilters((p) => ({ ...p, location: value }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Hoarding Type
                  </label>
                  <input
                    value={filters.type}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, type: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Size
                  </label>
                  <select
                    value={filters.size}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, size: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  >
                    <option value="">Any</option>
                    {SIZE_PRESETS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Availability
                  </label>
                  <select
                    value={filters.availability}
                    onChange={(e) =>
                      setFilters((p) => ({
                        ...p,
                        availability: e.target.value,
                      }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  >
                    {AVAILABILITY_OPTIONS.map((o) => (
                      <option key={o.value || "__all"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-gray-600">
                  Total: <span className="font-medium">{total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Page size</label>
                  <select
                    value={limit}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLimit(v);
                      setPage(1);
                      loadHoardings(1);
                    }}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 overflow-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-2">Select</th>
                      <th className="text-left p-2">Code</th>
                      <th className="text-left p-2">City</th>
                      <th className="text-left p-2">Location / Area</th>
                      <th className="text-left p-2">Size</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-right p-2">Standard Rate</th>
                      <th className="text-right p-2">Minimum Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoardings.map((h) => {
                      const unavailable = isSelectionDisabledStatus(h.status);
                      const st = String(h.status || "").toLowerCase();
                      return (
                        <tr
                          key={h.id}
                          className={`border-t ${unavailable ? "bg-slate-100 text-slate-500" : "hover:bg-slate-50/60"}`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedSet.has(h.id)}
                              onChange={() => toggleSelect(h)}
                              disabled={unavailable}
                              className="accent-blue-600"
                            />
                          </td>
                          <td className="p-2">{h.code || "—"}</td>
                          <td className="p-2">{h.city || "—"}</td>
                          <td className="p-2">{locationLabel(h)}</td>
                          <td className="p-2">
                            {toFtLabel(h.widthCm, h.heightCm)}
                          </td>
                          <td className="p-2">{h.type || "—"}</td>
                          <td className="p-2">
                            {unavailable ? (
                              <span className="inline-flex items-center rounded-full bg-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {st === "booked"
                                  ? "Booked"
                                  : st === "blocked"
                                    ? "Blocked"
                                    : st === "live"
                                      ? "Live"
                                      : String(h.status || "—")}
                              </span>
                            ) : (
                              String(h.status || "—")
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {standardRateOf(h).toFixed(2)}
                          </td>
                          <td className="p-2 text-right">
                            {minimumRateOf(h).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                    {hoardings.length === 0 && !loading ? (
                      <tr>
                        <td
                          className="p-4 text-center text-gray-500"
                          colSpan={9}
                        >
                          No hoardings match the current filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-gray-600">
                  Page <span className="font-medium">{page}</span> /{" "}
                  {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadHoardings(Math.max(1, page - 1))}
                    disabled={loading || page <= 1}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() =>
                      loadHoardings(Math.min(totalPages, page + 1))
                    }
                    disabled={loading || page >= totalPages}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white/95 backdrop-blur rounded-2xl border border-white/30 shadow-lg p-4 text-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">
                  Selected Hoardings
                </h2>
                <div className="text-xs text-gray-600">
                  Number of Proposal: {selected.length}
                </div>
              </div>

              <div className="mt-3 overflow-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-2">Code</th>
                      <th className="text-left p-2">Location</th>
                      <th className="text-left p-2">Size</th>
                      {mode === "WITH_RATE" ? (
                        <>
                          <th className="text-right p-2">Base</th>
                          <th className="text-right p-2">Min</th>
                          <th className="text-right p-2">Discount %</th>
                          <th className="text-center p-2">Illum</th>
                          <th className="text-right p-2">Illum Cost</th>
                          <th className="text-right p-2">Final</th>
                          {includeGst ? (
                            <th className="text-right p-2">GST</th>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <th className="text-center p-2">Illum</th>
                        </>
                      )}
                      <th className="text-right p-2">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map((s) => {
                      const discPct = clampPctLocal(s.discountPct);
                      const illumCost = s.illumination
                        ? Math.max(0, s.illuminationCost)
                        : 0;
                      const final = computeFinalRate({
                        baseRate: s.baseRate,
                        discountPct: discPct,
                        illuminationCost: illumCost,
                      });
                      const gstAmt = includeGst
                        ? Math.max(0, final) * (clampPctLocal(gstRatePct) / 100)
                        : 0;

                      return (
                        <tr
                          key={s.hoardingId}
                          className="border-t hover:bg-slate-50/60"
                        >
                          <td className="p-2">{s.hoardingCode || "—"}</td>
                          <td className="p-2">{s.location || "—"}</td>
                          <td className="p-2">{s.sizeLabel || "—"}</td>
                          {mode === "WITH_RATE" ? (
                            <>
                              <td className="p-2 text-right">
                                {s.baseRate.toFixed(2)}
                              </td>
                              <td className="p-2 text-right">
                                {Math.max(0, s.minimumRate || 0).toFixed(2)}
                              </td>
                              <td className="p-2 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={s.discountPct}
                                  onChange={(e) =>
                                    updateSelected(s.hoardingId, {
                                      discountPct: clampPctLocal(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                  className="w-24 border border-slate-200 rounded-xl px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={s.illumination}
                                  onChange={(e) =>
                                    updateSelected(s.hoardingId, {
                                      illumination: e.target.checked,
                                    })
                                  }
                                  className="accent-blue-600"
                                />
                              </td>
                              <td className="p-2 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  value={s.illuminationCost}
                                  onChange={(e) =>
                                    updateSelected(s.hoardingId, {
                                      illuminationCost: Math.max(
                                        0,
                                        toMoney(e.target.value),
                                      ),
                                    })
                                  }
                                  disabled={!s.illumination}
                                  className="w-28 border border-slate-200 rounded-xl px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 disabled:opacity-60"
                                />
                              </td>
                              <td className="p-2 text-right">
                                {Math.max(0, final).toFixed(2)}
                              </td>
                              {includeGst ? (
                                <td className="p-2 text-right">
                                  {gstAmt.toFixed(2)}
                                </td>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={s.illumination}
                                  onChange={(e) =>
                                    updateSelected(s.hoardingId, {
                                      illumination: e.target.checked,
                                    })
                                  }
                                />
                              </td>
                            </>
                          )}

                          <td className="p-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setSelected((prev) =>
                                  prev.filter(
                                    (x) => x.hoardingId !== s.hoardingId,
                                  ),
                                )
                              }
                              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {selected.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            mode === "WITH_RATE" ? (includeGst ? 11 : 10) : 5
                          }
                          className="p-4 text-center text-gray-500"
                        >
                          No hoardings selected yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {mode === "WITH_RATE" ? (
                <div className="mt-3 text-xs text-gray-600">
                  PDF includes standard rate, GST, discount, final rate, printing,
                  mounting, and grand total.
                </div>
              ) : (
                <div className="mt-3 text-xs text-gray-600">
                  WITHOUT_RATE mode: rates are hidden in the PDF table.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
