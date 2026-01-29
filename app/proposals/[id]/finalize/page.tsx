"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { proposalsAPI } from "@/lib/api";
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
  const [submitting, setSubmitting] = useState(false);

  const canFinalize = roleName === "sales";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const resp = await proposalsAPI.getById(id);
        const p = resp?.data || null;
        setProposal(p);
        const initial: Record<string, boolean> = {};
        for (const h of p?.hoardings || []) {
          if (h?.hoardingId) initial[String(h.hoardingId)] = true;
        }
        setSelected(initial);
      } catch (e: any) {
        showError(e?.response?.data?.message || "Failed to load proposal");
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected],
  );

  const confirm = async () => {
    if (!canFinalize) {
      showError("Only Sales can finalize");
      return;
    }
    if (selectedIds.length === 0) {
      showError("Select at least one hoarding");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await proposalsAPI.finalize(id, {
        hoardingIds: selectedIds,
      });
      if (!resp?.success) {
        showError(resp?.message || "Failed to finalize");
        return;
      }
      showSuccess("Hoardings finalized");
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
              Select only the hoardings you want to book now.
            </div>
          </div>
          <Link
            href={`/proposals/${id}`}
            className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
          >
            Back
          </Link>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : !proposal ? (
          <div>Not found</div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm p-4">
            <div className="text-sm mb-3">
              <span className="font-semibold">Client:</span>{" "}
              {proposal.client?.name} ({proposal.client?.phone})
            </div>

            <div className="border rounded-xl overflow-auto max-h-[320px]">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-2">Finalize</th>
                    <th className="text-left p-2">Code</th>
                    <th className="text-left p-2">City</th>
                    <th className="text-left p-2">Location</th>
                    <th className="text-right p-2">Final Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(proposal.hoardings || []).map((h: any) => {
                    const hid = String(h.hoardingId || "");
                    return (
                      <tr key={h.id} className="border-t hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={!!selected[hid]}
                            disabled={!hid}
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
                        <td className="p-2 text-right">
                          {typeof h.finalRate !== "undefined"
                            ? String(h.finalRate)
                            : "—"}
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
              </div>
              <button
                onClick={confirm}
                disabled={!canFinalize || submitting}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? "Finalizing..." : "Confirm Finalize"}
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
