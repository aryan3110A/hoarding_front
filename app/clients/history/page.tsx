"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import { clientsAPI } from "@/lib/api";
import { getRoleFromUser } from "@/lib/rbac";
import ProtectedRoute from "@/components/ProtectedRoute";
import { showError } from "@/lib/toast";

export default function ClientHistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userFromContext = useUser();

  const urlClientId = searchParams?.get("clientId") || "";

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(urlClientId);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [historyData, setHistoryData] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);

  const [portalReady, setPortalReady] = useState(false);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const updateMenuRect = () => {
    const el = inputRef.current;
    if (!el) {
      setMenuRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const top = rect.bottom + 4;
    const viewportBottomGap = Math.max(120, window.innerHeight - top - 12);
    setMenuRect({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(240, viewportBottomGap),
    });
  };

  useEffect(() => {
    if (!dropdownOpen) return;
    updateMenuRect();

    const onScroll = () => updateMenuRect();
    const onResize = () => updateMenuRect();
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [dropdownOpen, searchTerm, clients]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const inRoot = !!rootRef.current?.contains(target);
      const inMenu = !!menuRef.current?.contains(target);
      if (!inRoot && !inMenu) setDropdownOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Load clients list
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoadingClients(true);
        const res = await clientsAPI.getAll();
        setClients(Array.isArray(res?.data) ? res.data : []);
      } catch (err: any) {
        showError(err?.response?.data?.message || "Failed to load clients list");
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  // Sync state if URL search param changes
  useEffect(() => {
    if (urlClientId) {
      setSelectedClientId(urlClientId);
    }
  }, [urlClientId]);

  // Load history when selected client changes
  useEffect(() => {
    if (!selectedClientId) {
      setHistoryData(null);
      return;
    }

    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const res = await clientsAPI.getHistory(selectedClientId);
        if (res?.success && res?.data) {
          setHistoryData(res.data);
        } else {
          showError(res?.message || "Failed to load client history");
        }
      } catch (err: any) {
        showError(err?.response?.data?.message || "Failed to load client history");
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedClientId]);

  // Filter clients based on search input
  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(term) ||
        (c.companyName || "").toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term)
    );
  }, [clients, searchTerm]);

  // Find currently selected client basic details
  const selectedClientDetails = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || historyData?.client || null;
  }, [clients, selectedClientId, historyData]);

  const selectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setSearchTerm("");
    setDropdownOpen(false);
    // Update URL query string
    const params = new URLSearchParams(window.location.search);
    params.set("clientId", clientId);
    router.replace(`${window.location.pathname}?${params.toString()}`);
  };

  const clearSelection = () => {
    setSelectedClientId("");
    setHistoryData(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("clientId");
    router.replace(`${window.location.pathname}?${params.toString()}`);
  };

  const formatDate = (value: unknown, showTime = false) => {
    if (!value) return "N/A";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: showTime ? "short" : undefined,
    });
  };

  const formatPrice = (value: unknown) => {
    const num = Number(value);
    if (Number.isNaN(num)) return "N/A";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <ProtectedRoute component="bookings">
      <div className="px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Client History Dashboard
              </h1>
              <p className="text-white/80 mt-1 text-sm">
                View historical bookings, active status, contract renewals, and chronological timelines.
              </p>
            </div>
            {selectedClientId && (
              <button
                type="button"
                onClick={clearSelection}
                className="self-start md:self-auto inline-flex items-center px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm transition"
              >
                ← Select Another Client
              </button>
            )}
          </div>

          {/* Client Selection Section */}
          {!selectedClientId && (
            <div className="bg-white/95 backdrop-blur rounded-2xl border border-white/20 shadow-xl p-6 md:p-8 text-center max-w-xl mx-auto">
              <div className="text-4xl mb-4">👥</div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Select a Client</h2>
              <p className="text-slate-600 text-sm mb-6">
                Search by name, company, or phone number to load their booking and contract timeline.
              </p>

              {/* Autocomplete Search input */}
              <div className="relative text-left" ref={rootRef}>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Type name, company or mobile..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 text-sm shadow-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg"
                    >
                      ×
                    </button>
                  )}
                </div>

                {portalReady && dropdownOpen && menuRect
                  ? createPortal(
                      <div
                        ref={menuRef}
                        className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto"
                        onWheel={(e) => e.stopPropagation()}
                        style={{
                          top: menuRect.top,
                          left: menuRect.left,
                          width: menuRect.width,
                          maxHeight: menuRect.maxHeight,
                        }}
                      >
                        {loadingClients ? (
                          <div className="p-4 text-center text-sm text-slate-500">
                            Loading client list...
                          </div>
                        ) : filteredClients.length === 0 ? (
                          <div className="p-4 text-center text-sm text-slate-500">
                            No clients found matching &quot;{searchTerm}&quot;
                          </div>
                        ) : (
                          <div className="py-1">
                            {filteredClients.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => selectClient(client.id)}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-55 border-b border-slate-100 last:border-none transition"
                              >
                                <div className="font-semibold text-slate-800 text-sm">
                                  {client.name}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                  {client.companyName && <span>🏢 {client.companyName}</span>}
                                  <span>📞 {client.phone}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>,
                      document.body,
                    )
                  : null}
              </div>
            </div>
          )}

          {/* Client Loaded Section */}
          {selectedClientId && (
            <div className="space-y-8">
              {/* Selected Client Card Details */}
              <div className="bg-white/95 backdrop-blur rounded-2xl border border-white/20 shadow-xl p-5 md:p-6 text-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      Currently Viewing
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mt-1">
                      {selectedClientDetails?.name || "Client details"}
                    </h2>
                    <div className="text-sm text-slate-500 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      {selectedClientDetails?.companyName && (
                        <span className="flex items-center gap-1.5">
                          🏢 <strong>Company:</strong> {selectedClientDetails.companyName}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        📞 <strong>Phone:</strong> {selectedClientDetails?.phone}
                      </span>
                      {selectedClientDetails?.email && (
                        <span className="flex items-center gap-1.5">
                          ✉️ <strong>Email:</strong> {selectedClientDetails.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/clients/new?returnTo=/clients/history?clientId=${selectedClientId}`);
                    }}
                    className="self-start sm:self-center inline-flex items-center px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition"
                  >
                    Edit Client Info
                  </button>
                </div>
              </div>

              {loadingHistory ? (
                <div className="text-center py-16 bg-white/10 rounded-2xl border border-white/10">
                  <div className="loading-spinner mx-auto"></div>
                  <p className="text-white mt-4 text-sm">Loading timeline details...</p>
                </div>
              ) : !historyData ? (
                <div className="text-center py-16 bg-white/10 rounded-2xl border border-white/10">
                  <p className="text-white text-sm">No history data could be loaded.</p>
                </div>
              ) : (
                <>
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    {/* Metric Cards */}
                    <div className="bg-white/95 rounded-xl p-4 shadow-md border-l-4 border-blue-500">
                      <div className="text-xs font-medium text-slate-500 uppercase">Booked Total</div>
                      <div className="text-2xl font-bold text-slate-950 mt-1">
                        {historyData.metrics?.totalBooked ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Non-cancelled slots</div>
                    </div>

                    <div className="bg-white/95 rounded-xl p-4 shadow-md border-l-4 border-indigo-500">
                      <div className="text-xs font-medium text-slate-500 uppercase">Renewed Contracts</div>
                      <div className="text-2xl font-bold text-slate-950 mt-1">
                        {historyData.metrics?.totalRenewed ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Continued campaigns</div>
                    </div>

                    <div className="bg-white/95 rounded-xl p-4 shadow-md border-l-4 border-green-500">
                      <div className="text-xs font-medium text-slate-500 uppercase">Active</div>
                      <div className="text-2xl font-bold text-slate-950 mt-1">
                        {historyData.metrics?.active ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Live running sites</div>
                    </div>

                    <div className="bg-white/95 rounded-xl p-4 shadow-md border-l-4 border-slate-500">
                      <div className="text-xs font-medium text-slate-500 uppercase">Expired</div>
                      <div className="text-2xl font-bold text-slate-950 mt-1">
                        {historyData.metrics?.expired ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Completed events</div>
                    </div>

                    <div className="bg-white/95 rounded-xl p-4 shadow-md border-l-4 border-amber-500">
                      <div className="text-xs font-medium text-slate-500 uppercase">Blocked/Pending</div>
                      <div className="text-2xl font-bold text-slate-950 mt-1">
                        {historyData.metrics?.blocked ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Awaiting approvals</div>
                    </div>

                    <div className="bg-white/95 rounded-xl p-4 shadow-md border-l-4 border-rose-500">
                      <div className="text-xs font-medium text-slate-500 uppercase">Unmounted</div>
                      <div className="text-2xl font-bold text-slate-950 mt-1">
                        {historyData.metrics?.unmounted ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Released/Cancelled</div>
                    </div>
                  </div>

                  {/* Vertical Chronological Timeline */}
                  <div>
                    <h3 className="text-xl font-bold text-white mb-6">Booking &amp; Contract History Timeline</h3>

                    {(!historyData.timeline || historyData.timeline.length === 0) ? (
                      <div className="bg-white/95 rounded-2xl border border-white/20 shadow-xl p-8 text-center text-slate-600">
                        <div className="text-3xl mb-3">📭</div>
                        <h4 className="font-bold text-slate-800">No events found</h4>
                        <p className="text-sm mt-1">This client has no recorded booking tokens or contract agreements.</p>
                      </div>
                    ) : (
                      <div className="relative border-l-2 border-white/20 ml-4 pl-8 space-y-8 pb-4">
                        {historyData.timeline.map((event: any) => {
                          const isToken = event.type === "token";
                          const badgeColor = isToken
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-purple-50 text-purple-700 border-purple-200";

                          return (
                            <div key={event.id} className="relative group">
                              {/* Timeline indicator circle */}
                              <div
                                className={`absolute -left-[45px] top-1.5 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-md border-2 ${
                                  isToken
                                    ? "bg-slate-950 border-sky-400"
                                    : "bg-slate-950 border-purple-400"
                                } z-10 transition-transform duration-250 group-hover:scale-110`}
                              >
                                {isToken ? "📅" : "📄"}
                              </div>

                              {/* Event card details */}
                              <div className="bg-white/95 text-slate-800 rounded-xl p-5 shadow-lg border border-white/20 transition-all group-hover:border-white/40">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
                                      {isToken ? "Booking Token" : "Contract"}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">
                                      📅 {formatDate(event.eventDate, true)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                        ["ACTIVE", "BOOKED", "LIVE"].includes(event.status?.toUpperCase())
                                          ? "bg-green-100 text-green-800"
                                          : ["CANCELLED", "RELEASED"].includes(event.status?.toUpperCase())
                                          ? "bg-rose-100 text-rose-800"
                                          : ["PENDING", "BLOCKED"].includes(event.status?.toUpperCase())
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-slate-100 text-slate-800"
                                      }`}
                                    >
                                      {event.status}
                                    </span>
                                  </div>
                                </div>

                                <h4 className="text-base font-bold text-slate-900 mb-1">{event.title}</h4>
                                <p className="text-sm text-slate-600 mb-4">{event.description}</p>

                                {/* Event Details Subgrid */}
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-700">
                                  {isToken ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                      <div>
                                        <span className="text-slate-400 block mb-0.5">Hoarding Code</span>
                                        <strong>{event.details?.hoardingCode || "—"}</strong>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block mb-0.5">Duration</span>
                                        <strong>
                                          {event.details?.durationMonths
                                            ? `${event.details.durationMonths} Months`
                                            : "—"}
                                        </strong>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block mb-0.5">Timeline Range</span>
                                        <strong>
                                          {formatDate(event.details?.dateFrom)} to {formatDate(event.details?.dateTo)}
                                        </strong>
                                      </div>
                                      {event.details?.notes && (
                                        <div className="sm:col-span-2 md:col-span-3">
                                          <span className="text-slate-400 block mb-0.5">Notes</span>
                                          <p className="italic text-slate-500 font-medium">{event.details.notes}</p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                      <div>
                                        <span className="text-slate-400 block mb-0.5">Contract ID</span>
                                        <strong>{event.details?.contractNumber || "—"}</strong>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block mb-0.5">Monthly Base Price</span>
                                        <strong>{formatPrice(event.details?.basePrice)}</strong>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block mb-0.5 font-medium">Total Contract Value</span>
                                        <strong className="text-slate-900 font-semibold">
                                          {formatPrice(event.details?.totalValue)}
                                        </strong>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block mb-0.5">Duration</span>
                                        <strong>
                                          {event.details?.durationMonths
                                            ? `${event.details.durationMonths} Months`
                                            : "—"}
                                        </strong>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block mb-0.5">Active Period</span>
                                        <strong>
                                          {formatDate(event.details?.startDate)} to {formatDate(event.details?.endDate)}
                                        </strong>
                                      </div>
                                      {event.details?.renewedFrom && (
                                        <div>
                                          <span className="text-slate-400 block mb-0.5">Renewed From</span>
                                          <strong className="text-indigo-600">
                                            📄 {event.details.renewedFrom}
                                          </strong>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
