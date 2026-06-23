"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { proposalsAPI } from "@/lib/api";
import { getRoleFromUser } from "@/lib/rbac";

const toProposalFilenamePart = (value?: string | null) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  const sanitized = raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || "client";
};

const toProposalTimestampPart = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${safeDate.getFullYear()}${pad(safeDate.getMonth() + 1)}${pad(safeDate.getDate())}_${pad(
    safeDate.getHours(),
  )}${pad(safeDate.getMinutes())}${pad(safeDate.getSeconds())}`;
};

const buildProposalFilename = (proposal?: any) => {
  const clientPart = toProposalFilenamePart(
    proposal?.client?.name || proposal?.clientName,
  );
  const timestampPart = toProposalTimestampPart(
    proposal?.pdfGeneratedAt || proposal?.updatedAt || proposal?.createdAt,
  );
  return `proposal_${clientPart}_${timestampPart}.pdf`;
};

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

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

  const canEdit = proposal?.status === "DRAFT" && roleName === "sales";

  const belowMinHoardings = useMemo(() => {
    return (proposal?.hoardings || []).filter((h: any) => {
      if (h.rateApprovalStatus === "PENDING_APPROVAL" || h.rateApprovalStatus === "REJECTED") return true;
      const min = Number(h.hoarding?.minimumRate || 0);
      const final = Number(h.finalRate || 0);
      if (min > 0 && final < min && h.rateApprovalStatus !== "APPROVED") return true;
      return false;
    });
  }, [proposal]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await proposalsAPI.getById(String(id));
        setProposal(data.data);
      } catch (e) {}
      setLoading(false);
    };
    if (id) load();
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (!proposal) return <div>Not found</div>;

  const updateProposal = (patch: any) =>
    setProposal((p: any) => ({ ...p, ...patch }));

  const saveDraft = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const resp = await proposalsAPI.updateDraft(String(id), {
        mode: proposal.mode,
        globalDiscountPct: Number(proposal.globalDiscountPct ?? 0),
        includeGst: !!proposal.includeGst,
        gstRatePct: Number(proposal.gstRatePct ?? 18),
        printingCharges: Number(proposal.printingCharges ?? 0),
        mountingCharges: Number(proposal.mountingCharges ?? 0),
        hoardings: (proposal.hoardings || []).map((h: any) => ({
          hoardingId: h.hoardingId,
          discountPct: Number(h.discountPct ?? 0),
          illumination: !!h.illumination,
          illuminationCost: Number(h.illuminationCost ?? 0),
          printingRate: Number(h.printingRate ?? 0),
          mountingRate: Number(h.mountingRate ?? 0),
        })),
      });
      setProposal(resp.data);
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const generatePdf = async () => {
    setActing(true);
    try {
      const resp = await proposalsAPI.generatePdf(String(id));
      setProposal(resp.data);
      await downloadPdf();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to generate PDF");
    } finally {
      setActing(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const resp = await proposalsAPI.downloadPdf(String(id));
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildProposalFilename(proposal);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to download PDF");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Proposal</h1>
          <div className="text-sm text-gray-600">
            {proposal.client?.name} ({proposal.client?.phone})
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadPdf}
            className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
          >
            Download PDF
          </button>
          {proposal.status === "DRAFT" && (
            <>
              <button
                onClick={() => router.push(`/proposals/${id}/edit`)}
                className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
              >
                Open Builder
              </button>
              <button
                onClick={generatePdf}
                disabled={acting || belowMinHoardings.length > 0}
                className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              >
                {acting ? "Generating..." : "Generate PDF"}
              </button>
              <button
                onClick={() => {
                  if (belowMinHoardings.length > 0) {
                    alert("Cannot finalize proposal with pending or rejected below-minimum rate approvals.");
                    return;
                  }
                  router.push(`/proposals/${id}/finalize`);
                }}
                disabled={belowMinHoardings.length > 0}
                className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50"
              >
                Finalize Hoardings
              </button>
            </>
          )}
        </div>
      </div>

      {belowMinHoardings.length > 0 && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
          <div className="flex items-center gap-2 font-semibold text-amber-800 text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Below-Minimum Rate Warning ({belowMinHoardings.length} hoarding(s))</span>
          </div>
          <p className="text-xs text-amber-700 mt-1">
            This proposal contains rates that are below the standard minimum rate. PDF generation, finalizing, and sending are blocked until all rate approval requests are approved by Owner/Manager.
          </p>
        </div>
      )}
 
      <div className="bg-white border rounded p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-gray-600">Status</div>
            <div className="font-semibold">{proposal.status}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Mode</div>
            {canEdit ? (
              <select
                value={proposal.mode}
                onChange={(e) => updateProposal({ mode: e.target.value })}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="WITH_RATE">WITH_RATE</option>
                <option value="WITHOUT_RATE">WITHOUT_RATE</option>
              </select>
            ) : (
              <div className="font-semibold">{proposal.mode}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-600">Global Discount (%)</div>
            {canEdit ? (
              <input
                type="number"
                value={Number(proposal.globalDiscountPct ?? 0)}
                onChange={(e) =>
                  updateProposal({ globalDiscountPct: Number(e.target.value) })
                }
                className="border rounded px-2 py-1 text-sm w-28"
                min={0}
                max={100}
              />
            ) : (
              <div className="font-semibold">
                {String(proposal.globalDiscountPct ?? 0)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit ? (
              <input
                type="checkbox"
                checked={!!proposal.includeGst}
                onChange={(e) =>
                  updateProposal({ includeGst: e.target.checked })
                }
              />
            ) : null}
            <div>
              <div className="text-xs text-gray-600">Include GST</div>
              <div className="font-semibold">
                {proposal.includeGst ? "Yes" : "No"}
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600">GST Rate (%)</div>
            {canEdit ? (
              <input
                type="number"
                value={Number(proposal.gstRatePct ?? 18)}
                onChange={(e) =>
                  updateProposal({ gstRatePct: Number(e.target.value) })
                }
                className="border rounded px-2 py-1 text-sm w-28"
                min={0}
                max={100}
                disabled={!proposal.includeGst}
              />
            ) : (
              <div className="font-semibold">
                {String(proposal.gstRatePct ?? 18)}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-600">Printing Charges (₹)</div>
            {canEdit ? (
              <input
                type="number"
                value={Number(proposal.printingCharges ?? 0)}
                onChange={(e) =>
                  updateProposal({ printingCharges: Number(e.target.value) })
                }
                className="border rounded px-2 py-1 text-sm w-32"
                min={0}
              />
            ) : (
              <div className="font-semibold">
                {String(proposal.printingCharges ?? 0)}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-600">Mounting Charges (₹)</div>
            {canEdit ? (
              <input
                type="number"
                value={Number(proposal.mountingCharges ?? 0)}
                onChange={(e) =>
                  updateProposal({ mountingCharges: Number(e.target.value) })
                }
                className="border rounded px-2 py-1 text-sm w-32"
                min={0}
              />
            ) : (
              <div className="font-semibold">
                {String(proposal.mountingCharges ?? 0)}
              </div>
            )}
          </div>
          {canEdit ? (
            <div className="flex items-end">
              <button
                onClick={saveDraft}
                disabled={saving}
                className="px-3 py-2 rounded border bg-gray-50 hover:bg-gray-100 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 bg-white border rounded overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Code</th>
              <th className="text-left p-2">City</th>
              <th className="text-left p-2">Location</th>
              <th className="text-left p-2">Size</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Discount %</th>
              <th className="text-left p-2">Illum</th>
              <th className="text-left p-2">Illum Cost</th>
              <th className="text-right p-2">Print Rate (₹)</th>
              <th className="text-right p-2">Mount Rate (₹)</th>
              <th className="text-right p-2">Final Rate</th>
              <th className="text-left p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(proposal.hoardings || []).map((h: any) => (
              <tr key={h.id} className="border-t">
                <td className="p-2">
                  {h.hoardingCode || h.hoarding?.code || "—"}
                </td>
                <td className="p-2">{h.city || "—"}</td>
                <td className="p-2">
                  {[h.area, h.location].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="p-2">{h.sizeLabel || "—"}</td>
                <td className="p-2">{h.type || "—"}</td>
                <td className="p-2">
                  {canEdit ? (
                    <input
                      type="number"
                      value={Number(h.discountPct ?? 0)}
                      onChange={(e) =>
                        updateProposal({
                          hoardings: (proposal.hoardings || []).map((x: any) =>
                            x.id === h.id
                              ? { ...x, discountPct: Number(e.target.value) }
                              : x,
                          ),
                        })
                      }
                      className="w-24 border rounded px-2 py-1 text-sm"
                      min={0}
                      max={100}
                    />
                  ) : (
                    <span>{String(h.discountPct ?? 0)}</span>
                  )}
                </td>
                <td className="p-2">
                  {canEdit ? (
                    <input
                      type="checkbox"
                      checked={!!h.illumination}
                      onChange={(e) =>
                        updateProposal({
                          hoardings: (proposal.hoardings || []).map((x: any) =>
                            x.id === h.id
                              ? { ...x, illumination: e.target.checked }
                              : x,
                          ),
                        })
                      }
                    />
                  ) : (
                    <span>{h.illumination ? "Yes" : "No"}</span>
                  )}
                </td>
                <td className="p-2">
                  {canEdit ? (
                    <input
                      type="number"
                      value={h.illuminationCost ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateProposal({
                          hoardings: (proposal.hoardings || []).map((x: any) =>
                            x.id === h.id
                              ? {
                                  ...x,
                                  illuminationCost: val === "" ? "" : Number(val),
                                }
                              : x,
                          ),
                        });
                      }}
                      className="w-28 border rounded px-2 py-1 text-sm"
                      min={0}
                      step={0.01}
                      disabled={!h.illumination}
                    />
                  ) : (
                    <span>{String(h.illuminationCost ?? 0)}</span>
                  )}
                </td>
                <td className="p-2 text-right">
                  {canEdit ? (
                    <input
                      type="number"
                      value={h.printingRate ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateProposal({
                          hoardings: (proposal.hoardings || []).map((x: any) =>
                            x.id === h.id
                              ? {
                                  ...x,
                                  printingRate: val === "" ? "" : Number(val),
                                }
                              : x,
                          ),
                        });
                      }}
                      className="w-24 border rounded px-2 py-1 text-sm text-right"
                      min={0}
                    />
                  ) : (
                    <span>{String(h.printingRate ?? 0)}</span>
                  )}
                </td>
                <td className="p-2 text-right">
                  {canEdit ? (
                    <input
                      type="number"
                      value={h.mountingRate ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateProposal({
                          hoardings: (proposal.hoardings || []).map((x: any) =>
                            x.id === h.id
                              ? {
                                  ...x,
                                  mountingRate: val === "" ? "" : Number(val),
                                }
                              : x,
                          ),
                        });
                      }}
                      className="w-24 border rounded px-2 py-1 text-sm text-right"
                      min={0}
                    />
                  ) : (
                    <span>{String(h.mountingRate ?? 0)}</span>
                  )}
                </td>
                <td className="p-2 text-right">{String(h.finalRate ?? "0")}</td>
                <td className="p-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    h.rateApprovalStatus === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-800" :
                    h.rateApprovalStatus === "REJECTED" ? "bg-rose-100 text-rose-800" :
                    h.rateApprovalStatus === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"
                  }`}>
                    {h.rateApprovalStatus || "APPROVED"}
                  </span>
                </td>
              </tr>
            ))}
            {(proposal.hoardings || []).length === 0 ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={12}>
                  No hoardings
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
