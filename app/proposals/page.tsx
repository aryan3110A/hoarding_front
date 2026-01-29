"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { proposalsAPI } from "@/lib/api";

export default function ProposalsListPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const statusBadge = (status?: string) => {
    const s = String(status || "").toUpperCase();
    const base =
      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border";
    if (s === "DRAFT")
      return `${base} bg-amber-50 text-amber-800 border-amber-200`;
    if (s === "SENT") return `${base} bg-sky-50 text-sky-800 border-sky-200`;
    if (s === "FINALIZED")
      return `${base} bg-emerald-50 text-emerald-800 border-emerald-200`;
    if (s === "PARTIAL_FINALIZED")
      return `${base} bg-teal-50 text-teal-800 border-teal-200`;
    return `${base} bg-slate-50 text-slate-700 border-slate-200`;
  };

  const modeBadge = (mode?: string) => {
    const m = String(mode || "").toUpperCase();
    const base =
      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border";
    if (m === "WITH_RATE")
      return `${base} bg-indigo-50 text-indigo-800 border-indigo-200`;
    if (m === "WITHOUT_RATE")
      return `${base} bg-violet-50 text-violet-800 border-violet-200`;
    return `${base} bg-slate-50 text-slate-700 border-slate-200`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const data = await proposalsAPI.list();
        setProposals(data.data || []);
      } catch (e) {}
      setLoading(false);
    };
    load();
  }, []);

  if (loading)
    return (
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur border border-white/30 rounded-2xl shadow-xl p-6">
            <div className="animate-pulse">
              <div className="h-6 w-44 bg-slate-200 rounded mb-3" />
              <div className="h-4 w-72 bg-slate-100 rounded" />
              <div className="mt-6 h-40 bg-slate-100 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Proposals</h1>
            <div className="text-sm text-white/80">
              Manage drafts, download PDFs, and finalize hoardings.
            </div>
          </div>
          <Link
            href="/proposals/create"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition"
          >
            Create Proposal
          </Link>
        </div>

        {proposals.length === 0 ? (
          <div className="bg-white/85 backdrop-blur border border-white/30 rounded-2xl shadow-xl p-8 text-center">
            <div className="text-slate-900 font-semibold text-lg">
              No proposals yet
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Create your first proposal to generate a PDF.
            </div>
            <div className="mt-5">
              <Link
                href="/proposals/create"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition"
              >
                Create Proposal
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white/90 backdrop-blur border border-white/30 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full text-sm text-slate-800">
                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur border-b border-slate-200">
                  <tr className="text-left text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">Proposal</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Hoardings</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proposals.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-slate-700">
                          {String(p.id).slice(0, 8)}
                        </div>
                        <div className="text-[11px] text-slate-500">ID</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {p.client?.name || "—"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {p.client?.phone || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold">
                          {(p.hoardings || []).length}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadge(p.status)}>
                          {p.status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={modeBadge(p.mode)}>
                          {p.mode || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {p.createdAt
                          ? new Date(p.createdAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/proposals/${p.id}`}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
                          >
                            View
                          </Link>

                          {p.status === "DRAFT" && (
                            <Link
                              href={`/proposals/${p.id}/edit`}
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
                            >
                              Open Builder
                            </Link>
                          )}

                          {p.status === "DRAFT" && (
                            <Link
                              href={`/proposals/${p.id}/finalize`}
                              className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                            >
                              Finalize
                            </Link>
                          )}

                          <button
                            onClick={async () => {
                              try {
                                const resp = await proposalsAPI.downloadPdf(
                                  String(p.id),
                                );
                                const blob = new Blob([resp.data], {
                                  type: "application/pdf",
                                });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `proposal-${p.id}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                              } catch {
                                alert("Failed to download PDF");
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
