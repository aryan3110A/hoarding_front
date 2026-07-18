"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { hoardingsAPI, proposalsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";
import { getRoleFromUser } from "@/lib/rbac";

export default function FinalizeProposalPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id || "");

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

  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<any>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [finalRates, setFinalRates] = useState<Record<string, number>>({});
  const [rowActionLoading, setRowActionLoading] = useState<
    Record<string, "blocking" | undefined>
  >({});
  const [submitting, setSubmitting] = useState(false);

  // Below-minimum rate approval states
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approvalModalData, setApprovalModalData] = useState<{
    proposalId: string;
    hoardingId: string;
    hoardingCode: string;
    proposedRate: number;
    minimumRate: number;
    standardRate: number;
  } | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const handleRequestApproval = (h: any) => {
    const hid = String(h.hoardingId || "");
    const enteredRate = Number(finalRates[hid] ?? h.finalRate ?? 0);
    const min = Number(h.hoarding?.minimumRate || 0);
    const std = Number(h.baseRate || h.hoarding?.standardRate || 0);
    setApprovalModalData({
      proposalId: id,
      hoardingId: hid,
      hoardingCode: h.hoardingCode || h.hoarding?.code || "",
      proposedRate: enteredRate,
      minimumRate: min,
      standardRate: std,
    });
    setIsApprovalModalOpen(true);
  };

  const isBelowMinAndNotApproved = (h: any) => {
    const hid = String(h.hoardingId || "");
    const enteredRate = Number(finalRates[hid] ?? h.finalRate ?? 0);
    const min = Number(h.hoarding?.minimumRate || 0);

    // If there's no minimum rate set, or the entered rate is >= minimum, never flag it
    if (min <= 0 || enteredRate >= min) {
      return false;
    }

    // Rate IS below minimum — only block if not yet approved
    return h.rateApprovalStatus !== "APPROVED";
  };

  const belowMinHoardings = useMemo(() => {
    return (proposal?.hoardings || []).filter(isBelowMinAndNotApproved);
  }, [proposal, finalRates]);

  const canFinalize = roleName === "sales";

  const isNonFinalizable = (statusRaw: unknown) => {
    const s = String(statusRaw || "").toLowerCase();
    return ["booked", "live", "under_process"].includes(s);
  };

  const displayStatus = (statusRaw: unknown) => {
    const status = String(statusRaw || "available").toLowerCase();
    if (status === "tokenized") return "AVAILABLE";
    return status.toUpperCase();
  };

  const finalRateDraftKey = `proposal-finalize-finalRates:${id}`;

  const updateProposalRowStatus = (hid: string, nextStatus: string) => {
    setProposal((prev: any) => {
      if (!prev) return prev;
      const rows = Array.isArray(prev.hoardings) ? prev.hoardings : [];
      const nextRows = rows.map((row: any) => {
        if (String(row?.hoardingId || "") !== hid) return row;
        return {
          ...row,
          hoarding: {
            ...(row?.hoarding || {}),
            status: nextStatus,
          },
        };
      });
      return { ...prev, hoardings: nextRows };
    });

    if (["booked", "live", "under_process"].includes(nextStatus)) {
      setSelected((prev) => ({ ...prev, [hid]: false }));
    }
  };

  const loadProposal = async () => {
    setLoading(true);
    try {
      const resp = await proposalsAPI.getById(id);
      const p = resp?.data || null;
      setProposal(p);

      const initial: Record<string, boolean> = {};
      const initialRates: Record<string, number> = {};

      for (const h of p?.hoardings || []) {
        const hid = String(h?.hoardingId || "");
        const st = String(h?.hoarding?.status || "available").toLowerCase();
        if (hid && !isNonFinalizable(st)) initial[hid] = true;
        if (hid) initialRates[hid] = Number(h?.finalRate || 0);
      }

      let savedRates: Record<string, number> = {};
      try {
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem(finalRateDraftKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              savedRates = Object.fromEntries(
                Object.entries(parsed)
                  .map(([k, v]) => [String(k || ""), Number(v)] as const)
                  .filter(([k, v]) => !!k && Number.isFinite(v) && v >= 0),
              );
            }
          }
        }
      } catch {
        // ignore
      }

      const mergedRates: Record<string, number> = { ...initialRates };
      for (const hid of Object.keys(initialRates)) {
        if (typeof savedRates[hid] === "number") {
          mergedRates[hid] = savedRates[hid];
        }
      }

      setSelected(initial);
      setFinalRates(mergedRates);
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to load proposal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadProposal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(finalRateDraftKey, JSON.stringify(finalRates));
    } catch {
      // ignore
    }
  }, [finalRateDraftKey, finalRates]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected],
  );

  const pricing = useMemo(() => {
    type LineRate = { hid: string; base: number };
    const clampMoney = (v: unknown) => {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, n);
    };
    const clampPct = (v: unknown) => {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(100, n));
    };

    const rows = Array.isArray(proposal?.hoardings) ? proposal.hoardings : [];
    const includeGst = !!proposal?.includeGst;
    const gstRatePct = clampPct(proposal?.gstRatePct ?? 0);
    const discountTypeRaw = String(proposal?.discountType ?? "").toUpperCase();
    const discountType = discountTypeRaw === "FLAT" ? "FLAT" : "PERCENT";
    const discountValue = clampMoney(proposal?.discountValue ?? 0);
    const printingCharges = clampMoney(proposal?.printingCharges ?? 0);
    const mountingCharges = clampMoney(proposal?.mountingCharges ?? 0);

    const lineBaseRates: LineRate[] = rows
      .map((h: any) => {
        const hid = String(h?.hoardingId || "");
        const base = clampMoney(finalRates[hid] ?? h?.finalRate ?? 0);
        return { hid, base };
      })
      .filter((r: LineRate) => !!r.hid);

    const baseSubtotal = lineBaseRates.reduce((sum, r) => sum + r.base, 0);
    const discountAmount =
      discountType === "FLAT"
        ? Math.min(baseSubtotal, discountValue)
        : baseSubtotal * (clampPct(discountValue) / 100);

    const discounted = Math.max(0, baseSubtotal - discountAmount);
    const preGstWithCharges = discounted + printingCharges + mountingCharges;
    const gstAmount = includeGst ? preGstWithCharges * (gstRatePct / 100) : 0;
    const grandTotal = preGstWithCharges + gstAmount;

    const perRowPayable: Record<string, number> = {};
    if (lineBaseRates.length === 0) {
      return { perRowPayable, grandTotal };
    }

    if (baseSubtotal > 0) {
      for (const r of lineBaseRates) {
        perRowPayable[r.hid] = (r.base / baseSubtotal) * grandTotal;
      }
    } else {
      const each = grandTotal / lineBaseRates.length;
      for (const r of lineBaseRates) perRowPayable[r.hid] = each;
    }

    return { perRowPayable, grandTotal };
  }, [proposal, finalRates]);

  const proposalRows = Array.isArray(proposal?.hoardings)
    ? proposal.hoardings
    : [];
  const numberOfProposal = proposalRows.length;

  const selectedFinalizableIds = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return proposalRows
      .map((h: any) => {
        const hid = String(h?.hoardingId || "");
        const st = String(h?.hoarding?.status || "available").toLowerCase();
        if (!hid || !selectedSet.has(hid) || isNonFinalizable(st)) return "";
        return hid;
      })
      .filter(Boolean);
  }, [proposalRows, selectedIds]);

  const selectAllVisible = () => {
    const next: Record<string, boolean> = {};
    for (const h of proposalRows) {
      const hid = String(h?.hoardingId || "");
      const status = String(h?.hoarding?.status || "available").toLowerCase();
      const isDisabled = isNonFinalizable(status);
      if (hid && !isDisabled) next[hid] = true;
    }
    setSelected(next);
  };

  const clearSelection = () => {
    setSelected({});
  };

  const blockHoarding = async (hid: string) => {
    if (!hid || rowActionLoading[hid]) return;
    setRowActionLoading((prev) => ({ ...prev, [hid]: "blocking" }));
    try {
      const rate = Math.max(0, Number(finalRates[hid] || 0));
      const resp = await proposalsAPI.finalize(id, {
        hoardingIds: [hid],
        finalRates: { [hid]: rate },
      });
      if (!resp?.success) {
        showError(resp?.message || "Failed to block hoarding");
        return;
      }
      await loadProposal();
      showSuccess("Hoarding blocked");
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to block hoarding");
    } finally {
      setRowActionLoading((prev) => {
        const next = { ...prev };
        delete next[hid];
        return next;
      });
    }
  };

  const unblockHoarding = async (hid: string) => {
    if (!hid || rowActionLoading[hid]) return;
    setRowActionLoading((prev) => ({ ...prev, [hid]: "blocking" }));
    try {
      await hoardingsAPI.finalizeStatus(hid, "AVAILABLE");
      updateProposalRowStatus(hid, "available");
      showSuccess("Hoarding unblocked");
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to unblock hoarding");
    } finally {
      setRowActionLoading((prev) => {
        const next = { ...prev };
        delete next[hid];
        return next;
      });
    }
  };

  const confirm = async () => {
    if (!canFinalize) {
      showError("Only Sales can finalize");
      return;
    }
    if (selectedFinalizableIds.length === 0) {
      showError("Select at least one hoarding");
      return;
    }

    if (belowMinHoardings.length > 0) {
      showError("Cannot finalize proposal with pending or rejected below-minimum rate approvals.");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await proposalsAPI.finalize(id, {
        hoardingIds: selectedFinalizableIds,
        finalRates: Object.fromEntries(
          selectedFinalizableIds.map((hid: string) => [
            hid,
            Math.max(0, Number(finalRates[hid] || 0)),
          ]),
        ),
      });
      if (!resp?.success) {
        showError(resp?.message || "Failed to finalize");
        return;
      }
      try {
        if (typeof window !== "undefined")
          localStorage.removeItem(finalRateDraftKey);
      } catch {
        // ignore
      }
      showSuccess("Selected hoardings blocked");
      router.push("/proposals");
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to finalize");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute component="proposals">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Finalize Hoardings</h1>
            <div className="text-sm text-gray-600">
              Select only the hoardings you want to block now.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/proposals/pdf?proposalId=${encodeURIComponent(id)}`}
              className="px-3 py-2 rounded border bg-blue-600 text-white hover:bg-blue-700"
            >
              Add Hoarding
            </Link>
            <Link
              href={`/proposals/${id}`}
              className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
            >
              Back
            </Link>
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : !proposal ? (
          <div>Not found</div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm p-4">
            <div className="text-sm mb-3">
              <span className="font-semibold">Client:</span>{" "}
              {proposal.client?.companyName?.trim() ||
                proposal.client?.name}{" "}
              ({proposal.client?.phone})
            </div>

            {belowMinHoardings.length > 0 && (
              <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-semibold text-amber-800">
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Below-Minimum Rate Warning ({belowMinHoardings.length} hoarding(s))</span>
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  The following hoardings have rates below the standard minimum rate and are not approved. Finalization is blocked until approved by Owner/Manager.
                </div>
                <ul className="list-disc pl-5 mt-2 text-xs text-amber-800 space-y-1">
                  {belowMinHoardings.map((h: any) => {
                    const hid = String(h.hoardingId || "");
                    const rate = Number(finalRates[hid] ?? h.finalRate ?? 0);
                    const min = Number(h.hoarding?.minimumRate || 0);
                    return (
                      <li key={h.id}>
                        <span className="font-semibold">{h.hoardingCode}</span>: Entered ₹{rate.toFixed(2)} (Min: ₹{min.toFixed(2)}) · Status: <span className="font-semibold">{h.rateApprovalStatus || "PENDING_APPROVAL"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Need to include more hoardings for this same client? Use{" "}
              <span className="font-semibold">Add Hoarding</span> to reopen the
              proposal builder with this proposal prefilled, add more hoardings,
              generate the PDF again, and then continue finalizing from the
              updated list.
            </div>

            <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold">Number of Proposal:</span>
              <span>{numberOfProposal}</span>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllVisible}
                className="px-3 py-1.5 rounded border bg-white hover:bg-slate-50"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="px-3 py-1.5 rounded border bg-white hover:bg-slate-50"
              >
                Clear
              </button>
            </div>

            <div className="border rounded-xl overflow-auto max-h-[320px]">
              <table className="w-full text-sm min-w-[960px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-2">Finalize</th>
                    <th className="text-left p-2">Code</th>
                    <th className="text-left p-2">City</th>
                    <th className="text-left p-2">Location</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-right p-2">Min Rate</th>
                    <th className="text-left p-2">Approval</th>
                    <th className="text-right p-2">Final Rate</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {proposalRows.map((h: any) => {
                    const hid = String(h.hoardingId || "");
                    const status = String(
                      h?.hoarding?.status || "available",
                    ).toLowerCase();
                    const isDisabled = isNonFinalizable(status);
                    const rowBusy = !!rowActionLoading[hid];
                    return (
                      <tr key={h.id} className="border-t hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={!!selected[hid]}
                            disabled={!hid || isDisabled || rowBusy}
                            onChange={(e) =>
                              setSelected((p) => ({
                                ...p,
                                [hid]: e.target.checked,
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">{h.hoardingCode || "—"}</td>
                        <td className="p-2">{h.city || "—"}</td>
                        <td className="p-2">{h.location || "—"}</td>
                        <td className="p-2">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {displayStatus(status)}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          {Number(h.hoarding?.minimumRate || 0).toFixed(2)}
                        </td>
                        <td className="p-2 text-left">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            h.rateApprovalStatus === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-800" :
                            h.rateApprovalStatus === "REJECTED" ? "bg-rose-100 text-rose-800" :
                            h.rateApprovalStatus === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"
                          }`}>
                            {h.rateApprovalStatus || "APPROVED"}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <div className="text-sm font-semibold">
                            {Number(pricing.perRowPayable?.[hid] ?? 0).toFixed(
                              2,
                            )}
                          </div>
                          <div className="mt-1">
                            <input
                              type="number"
                              min={0}
                              value={Number(
                                finalRates[hid] ?? h.finalRate ?? 0,
                              )}
                              disabled={isDisabled || rowBusy}
                              onChange={(e) =>
                                setFinalRates((p) => ({
                                  ...p,
                                  [hid]: Math.max(
                                    0,
                                    Number(e.target.value || 0),
                                  ),
                                }))
                              }
                              className="w-28 border rounded px-2 py-1 text-right text-xs disabled:opacity-50"
                            />
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              Base rate
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-2 items-center">
                            {status !== "blocked" && isBelowMinAndNotApproved(h) && (
                              <button
                                type="button"
                                onClick={() => handleRequestApproval(h)}
                                className="px-2.5 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold shrink-0"
                              >
                                Request Approval
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={
                                !hid ||
                                rowBusy ||
                                status === "booked" ||
                                status === "live" ||
                                status === "under_process" ||
                                (status !== "blocked" && isBelowMinAndNotApproved(h))
                              }
                              onClick={() =>
                                status === "blocked"
                                  ? unblockHoarding(hid)
                                  : blockHoarding(hid)
                              }
                              className="px-2.5 py-1.5 rounded bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 shrink-0"
                            >
                              {rowActionLoading[hid] === "blocking"
                                ? status === "blocked"
                                  ? "Unblocking..."
                                  : "Blocking..."
                                : status === "blocked"
                                  ? "Unblock"
                                  : "Block"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Selected: {selectedIds.length}
                <span className="mx-2 text-slate-300">|</span>
                Final payable (total):{" "}
                <span className="font-semibold text-slate-800">
                  {Number(pricing.grandTotal ?? 0).toFixed(2)}
                </span>
              </div>
              <button
                onClick={confirm}
                disabled={!canFinalize || submitting || belowMinHoardings.length > 0}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? "Finalizing..." : "Confirm Finalize"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rate Approval Modal */}
      {isApprovalModalOpen && approvalModalData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-slate-900 border border-slate-200 shadow-2xl space-y-4">
            <h2 className="text-xl font-semibold border-b pb-2">Request Rate Approval</h2>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
              <div>
                Client:{" "}
                <span className="font-semibold text-slate-800">
                  {proposal?.client?.companyName?.trim() ||
                    proposal?.client?.name ||
                    "Client"}
                </span>
              </div>
              <div>Hoarding: <span className="font-semibold text-slate-800">{approvalModalData.hoardingCode}</span></div>
              <div>Standard Rate: <span className="font-semibold text-slate-800">₹{approvalModalData.standardRate.toFixed(2)}</span></div>
              <div>Minimum Rate: <span className="font-semibold text-slate-800">₹{approvalModalData.minimumRate.toFixed(2)}</span></div>
              <div className="col-span-2 text-amber-700 font-semibold border-t pt-1 mt-1">
                Proposed Rate: ₹{approvalModalData.proposedRate.toFixed(2)} (Difference: -₹{(approvalModalData.minimumRate - approvalModalData.proposedRate).toFixed(2)})
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for offering below minimum rate *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter reason..."
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks / Supporting Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter optional remarks..."
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsApprovalModalOpen(false);
                  setApprovalModalData(null);
                  setApprovalReason("");
                  setApprovalRemarks("");
                }}
                className="px-4 py-2 border rounded-xl text-sm font-semibold hover:bg-slate-50"
                disabled={submittingApproval}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!approvalReason.trim()) {
                    alert("Please enter a reason.");
                    return;
                  }
                  setSubmittingApproval(true);
                  try {
                    await proposalsAPI.requestRateApproval(approvalModalData.proposalId, {
                      hoardingId: approvalModalData.hoardingId,
                      proposedRate: approvalModalData.proposedRate,
                      reason: approvalReason,
                      remarks: approvalRemarks,
                    });
                    showSuccess("Approval request submitted!");
                    await loadProposal();
                    setIsApprovalModalOpen(false);
                    setApprovalModalData(null);
                    setApprovalReason("");
                    setApprovalRemarks("");
                  } catch (e: any) {
                    showError(e?.response?.data?.message || "Failed to submit approval request");
                  } finally {
                    setSubmittingApproval(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={submittingApproval}
              >
                {submittingApproval ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
