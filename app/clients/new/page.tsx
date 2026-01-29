"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { clientsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

export default function NewClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams?.get("returnTo") || "/proposals/create";
  const prefillName = searchParams?.get("prefillName") || "";
  const prefillPhone = searchParams?.get("prefillPhone") || "";

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: prefillName,
    phone: prefillPhone,
    email: "",
    companyName: "",
  });

  const canSubmit = useMemo(() => {
    return form.name.trim().length > 0 && form.phone.trim().length >= 6;
  }, [form.name, form.phone]);

  const submit = async () => {
    if (!canSubmit) {
      showError("Client name and phone are required");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await clientsAPI.create({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
      });
      if (!resp?.success) {
        showError(resp?.message || "Failed to create client");
        return;
      }

      const clientId = String(resp?.data?.id || "");
      if (!clientId) {
        showError("Client created but missing id");
        return;
      }

      showSuccess("Client created");
      const joiner = returnTo.includes("?") ? "&" : "?";
      router.push(
        `${returnTo}${joiner}clientId=${encodeURIComponent(clientId)}`,
      );
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute component="proposals">
      <div className="px-4 sm:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                New Client
              </h1>
              <div className="text-sm text-white/80">
                Create a client and return to Proposal Builder.
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push(returnTo)}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-white/30 bg-white/10 text-white hover:bg-white/15 backdrop-blur"
            >
              Cancel
            </button>
          </div>

          <div className="bg-white/95 backdrop-blur rounded-2xl border border-white/30 shadow-xl p-5 sm:p-6">
            <div className="text-sm text-slate-600 mb-4">
              Fields marked <span className="font-semibold">*</span> are
              required.
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Client Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone *
                </label>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  placeholder="e.g. 9876543210"
                />
                <div className="mt-1 text-[11px] text-slate-500">
                  Phone is required to create a client.
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email (optional)
                </label>
                <input
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  placeholder="e.g. rahul@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Company (optional)
                </label>
                <input
                  value={form.companyName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, companyName: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  placeholder="e.g. ABC Media"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Tip: Use a valid phone number to avoid duplicates.
                </div>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className={`inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition ${
                    !canSubmit ? "opacity-80" : ""
                  } ${submitting ? "opacity-60" : ""}`}
                >
                  {submitting ? "Saving..." : "Save Client"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
