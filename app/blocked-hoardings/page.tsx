"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { blockedHoardingsAPI } from "@/lib/api";
import { showError } from "@/lib/toast";

type BlockedHoardingItem = {
  hoardingId: string;
  code: string;
  location: string;
  size: string;
  blockedAt: string | null;
  blockExpiry: string | null;
  status: "Blocked" | "Extended Block";
};

type BlockedClientGroup = {
  clientId: string;
  clientName: string;
  phone: string;
  blockedCount: number;
  hoardings: BlockedHoardingItem[];
};

const PAGE_SIZE = 10;

const formatDateTime = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

export default function BlockedHoardingsPage() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<BlockedClientGroup[]>([]);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadData = async (q?: string) => {
    setLoading(true);
    try {
      const res = await blockedHoardingsAPI.byClient({ q: q || undefined });
      const list = Array.isArray(res?.data) ? res.data : [];
      setRows(list);
      setPage(1);
      if (
        expandedClientId &&
        !list.some((x: BlockedClientGroup) => x.clientId === expandedClientId)
      ) {
        setExpandedClientId(null);
      }
    } catch (error: any) {
      showError(
        error?.response?.data?.message || "Failed to load blocked hoardings",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(query);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
    [rows.length],
  );

  const visibleRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const toggleExpanded = (clientId: string) => {
    setExpandedClientId((prev) => (prev === clientId ? null : clientId));
  };

  return (
    <ProtectedRoute component="blockedHoardings">
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1>Blocked Hoardings</h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "6px" }}>
              Client-wise active blocked hoardings overview.
            </p>
          </div>
          <div style={{ width: "100%", maxWidth: "380px", minWidth: "260px" }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by client name or phone"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
            />
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding: "16px" }}>Loading...</div>
          ) : rows.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                color: "var(--text-secondary)",
              }}
            >
              No blocked hoardings found.
            </div>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Phone Number</th>
                    <th>Number of Blocked Hoardings</th>
                    <th>Expand / View</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((client) => {
                    const isOpen = expandedClientId === client.clientId;
                    return (
                      <Fragment key={client.clientId}>
                        <tr>
                          <td>{client.clientName || "-"}</td>
                          <td>{client.phone || "-"}</td>
                          <td>{client.blockedCount}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => toggleExpanded(client.clientId)}
                            >
                              {isOpen ? "Hide" : "View"}
                            </button>
                          </td>
                        </tr>

                        <tr>
                          <td
                            colSpan={4}
                            style={{ padding: 0, borderTop: "none" }}
                          >
                            <div
                              style={{
                                maxHeight: isOpen ? "520px" : "0px",
                                opacity: isOpen ? 1 : 0,
                                overflow: "hidden",
                                transition:
                                  "max-height 280ms ease, opacity 240ms ease",
                                background: "#f8fafc",
                                borderTop: isOpen
                                  ? "1px solid #e2e8f0"
                                  : "none",
                              }}
                            >
                              <div style={{ padding: "12px" }}>
                                <table className="table" style={{ margin: 0 }}>
                                  <thead>
                                    <tr>
                                      <th>Hoarding Code</th>
                                      <th>Location</th>
                                      <th>Size</th>
                                      <th>Block Date</th>
                                      <th>Block Expiry Time</th>
                                      <th>Status</th>
                                      <th>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {client.hoardings.map((h) => (
                                      <tr
                                        key={`${client.clientId}-${h.hoardingId}`}
                                      >
                                        <td>{h.code || "-"}</td>
                                        <td>{h.location || "-"}</td>
                                        <td>{h.size || "-"}</td>
                                        <td>{formatDateTime(h.blockedAt)}</td>
                                        <td>{formatDateTime(h.blockExpiry)}</td>
                                        <td>
                                          <span className="badge badge-warning">
                                            {h.status}
                                          </span>
                                        </td>
                                        <td>
                                          <Link
                                            href={`/hoardings/${h.hoardingId}`}
                                            className="btn btn-secondary"
                                          >
                                            View Details
                                          </Link>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>

              <div
                style={{
                  marginTop: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <div style={{ color: "var(--text-secondary)" }}>
                  Showing {visibleRows.length} of {rows.length} clients
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <div
                    style={{
                      alignSelf: "center",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Page {page} / {totalPages}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
