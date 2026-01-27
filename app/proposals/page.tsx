"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { proposalsAPI } from "@/lib/api";

export default function ProposalsListPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Proposals</h1>
        <Link
          href="/proposals/create"
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          Create Proposal
        </Link>
      </div>

      {proposals.length === 0 ? (
        <div>No proposals</div>
      ) : (
        <div className="bg-white border rounded overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Client</th>
                <th>Hoardings</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.client?.name} ({p.client?.phone})
                  </td>
                  <td>{(p.hoardings || []).length}</td>
                  <td>{p.status || "—"}</td>
                  <td>{p.mode || "—"}</td>
                  <td>{new Date(p.createdAt).toLocaleString()}</td>
                  <td>
                    <Link
                      href={`/proposals/${p.id}`}
                      className="px-3 py-1.5 rounded border bg-gray-50 hover:bg-gray-100"
                    >
                      Open
                    </Link>
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
                      className="px-3 py-1.5 rounded bg-blue-600 text-white ml-2"
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
