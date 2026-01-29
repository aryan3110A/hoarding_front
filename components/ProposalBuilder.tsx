"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clientsAPI, hoardingsAPI, proposalsAPI } from "@/lib/api";
import AccessDenied from "@/components/AccessDenied";
import { getRoleFromUser } from "@/lib/rbac";

type ProposalMode = "WITH_RATE" | "WITHOUT_RATE";

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
  baseRate?: string | number | null;
  illumination?: boolean | null;
  illuminationCost?: string | number | null;
};

type SelectedHoarding = {
  hoardingId: string;
  hoardingCode?: string | null;
  baseRate: number;
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

// Must match backend computeLineFinalRate() exactly.
const computeFinalRate = (args: {
  baseRate: number;
  discountPct: number;
  illuminationCost: number;
  globalDiscountPct: number;
}) => {
  const discounted = args.baseRate * (1 - args.discountPct / 100);
  const beforeGlobal = discounted + args.illuminationCost;
  const final = beforeGlobal * (1 - args.globalDiscountPct / 100);
  return final;
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
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number>(0);
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

  const [filters, setFilters] = useState({
    city: "",
    area: "",
    location: "",
    type: "",
    size: "",
    availability: "available",
  });

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
        globalDiscountPct,
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
      if (typeof parsed.globalDiscountPct === "number")
        setGlobalDiscountPct(parsed.globalDiscountPct);
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

  const totals = useMemo(() => {
    if (mode === "WITHOUT_RATE") {
      return { subtotal: 0, gst: 0, grandTotal: 0 };
    }
    const globalPct = clampPctLocal(globalDiscountPct);
    const gstPct = clampPctLocal(gstRatePct);

    let subtotal = 0;
    for (const s of selected) {
      const final = computeFinalRate({
        baseRate: s.baseRate,
        discountPct: clampPctLocal(s.discountPct),
        illuminationCost: s.illumination ? Math.max(0, s.illuminationCost) : 0,
        globalDiscountPct: globalPct,
      });
      subtotal += Math.max(0, final);
    }

    const gst = includeGst ? subtotal * (gstPct / 100) : 0;
    const grandTotal = subtotal + gst;
    return { subtotal, gst, grandTotal };
  }, [selected, mode, globalDiscountPct, includeGst, gstRatePct]);

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
        setGlobalDiscountPct(Number(p.globalDiscountPct ?? 0));
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
              baseRate: toMoney(h.baseRate),
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
      location: "",
      type: "",
      size: "",
      availability: "available",
    });
    setPage(1);
    loadHoardings(1);
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
    const baseRate = Math.max(0, toMoney(h.baseRate));
    setSelected((prev) => {
      const exists = prev.find((p) => p.hoardingId === h.id);
      if (exists) return prev.filter((p) => p.hoardingId !== h.id);
      return [
        ...prev,
        {
          hoardingId: h.id,
          hoardingCode: h.code,
          baseRate,
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
    const globalPct = clampPctLocal(globalDiscountPct);
    for (const s of selected) {
      const lineFinal = computeFinalRate({
        baseRate: s.baseRate,
        discountPct: clampPctLocal(s.discountPct),
        illuminationCost: s.illumination ? Math.max(0, s.illuminationCost) : 0,
        globalDiscountPct: globalPct,
      });
      if (lineFinal + 1e-9 < s.baseRate) {
        return "Final rate cannot be lower than the base rate.";
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
        mode,
        globalDiscountPct: clampPctLocal(globalDiscountPct),
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

      // Generate + store PDF but keep proposal as DRAFT (not SENT)
      await proposalsAPI.generatePdf(String(id));

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
      alert(e?.response?.data?.message || "Failed to generate PDF");
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
            <button
              onClick={handleSaveDraft}
              disabled={saving || acting}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-white/30 bg-white/10 text-white hover:bg-white/15 backdrop-blur disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={handleGeneratePdf}
              disabled={saving || acting}
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
              <div className="bg-white/95 backdrop-blur rounded-2xl border border-white/30 shadow-lg p-4 text-slate-900">
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
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  />

                  {clientDropdownOpen ? (
                    <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow-sm max-h-64 overflow-auto">
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
                    </div>
                  ) : null}
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

              <div className="bg-white/95 backdrop-blur rounded-2xl border border-white/30 shadow-lg p-4 text-slate-900">
                <h2 className="font-semibold mb-3 text-slate-900">
                  Proposal Settings
                </h2>
                <div className="grid grid-cols-2 gap-3">
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
                      Global Discount %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={globalDiscountPct}
                      onChange={(e) =>
                        setGlobalDiscountPct(clampPctLocal(e.target.value))
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
                    {includeGst ? (
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-600">GST</span>
                        <span>{totals.gst.toFixed(2)}</span>
                      </div>
                    ) : null}
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
                    Only matching hoardings are shown. Pagination is mandatory.
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadHoardings(1)}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 text-sm disabled:opacity-50"
                  >
                    {loading ? "Searching..." : "Search"}
                  </button>
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm"
                  >
                    Reset
                  </button>
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
                    Location
                  </label>
                  <input
                    value={filters.location}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, location: e.target.value }))
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
                      <th className="text-right p-2">Base Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoardings.map((h) => (
                      <tr key={h.id} className="border-t hover:bg-slate-50/60">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(h.id)}
                            onChange={() => toggleSelect(h)}
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
                        <td className="p-2">{String(h.status || "—")}</td>
                        <td className="p-2 text-right">
                          {toMoney(h.baseRate).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {hoardings.length === 0 && !loading ? (
                      <tr>
                        <td
                          className="p-4 text-center text-gray-500"
                          colSpan={8}
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
                  {selected.length} selected
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
                      const globalPct = clampPctLocal(globalDiscountPct);
                      const discPct = clampPctLocal(s.discountPct);
                      const illumCost = s.illumination
                        ? Math.max(0, s.illuminationCost)
                        : 0;
                      const final = computeFinalRate({
                        baseRate: s.baseRate,
                        discountPct: discPct,
                        illuminationCost: illumCost,
                        globalDiscountPct: globalPct,
                      });
                      const invalid = final + 1e-9 < s.baseRate;
                      const gstAmt = includeGst
                        ? Math.max(0, final) * (clampPctLocal(gstRatePct) / 100)
                        : 0;

                      return (
                        <tr
                          key={s.hoardingId}
                          className={`border-t hover:bg-slate-50/60 ${invalid ? "bg-red-50" : ""}`}
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
                              <td
                                className={`p-2 text-right ${invalid ? "text-red-700 font-semibold" : ""}`}
                              >
                                {Math.max(0, final).toFixed(2)}
                                {invalid ? (
                                  <div className="text-[11px] text-red-700">
                                    Final &lt; base
                                  </div>
                                ) : null}
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
                            mode === "WITH_RATE" ? (includeGst ? 10 : 9) : 5
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
                  Pricing discipline enforced: base rate is locked; final rate
                  must not go below base.
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
