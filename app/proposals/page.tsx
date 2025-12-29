"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function ProposalsListPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers: any = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const resp = await fetch(`${API}/api/proposals`, { headers });
        const data = await resp.json();
        if (resp.ok) setProposals(data.data || []);
      } catch (e) {}
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Proposals</h1>
        <Link href="/proposals/create" className="btn btn-primary">
          Create Proposal
        </Link>
      </div>

      {proposals.length === 0 ? (
        <div>No proposals</div>
      ) : (
        <div>
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Hoardings</th>
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
                  <td>{new Date(p.createdAt).toLocaleString()}</td>
                  <td>
                    <Link
                      href={`/proposals/${p.id}`}
                      className="btn btn-secondary"
                    >
                      Open
                    </Link>
                    <a
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        try {
                          const API =
                            process.env.NEXT_PUBLIC_API_URL ||
                            "http://localhost:3001";
                          const token =
                            typeof window !== "undefined"
                              ? localStorage.getItem("token")
                              : null;
                          const headers: any = {
                            "Content-Type": "application/json",
                          };
                          if (token) headers.Authorization = `Bearer ${token}`;

                          const resp = await fetch(`${API}/api/proposals/pdf`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                              hoardings: (p.hoardings || []).map(
                                (h: any) => h.hoardingId
                              ),
                              client: { name: p.client?.name },
                            }),
                          });

                          if (resp.ok) {
                            const blob = await resp.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "proposal.pdf";
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                          } else {
                            alert("Failed to generate PDF");
                          }
                        } catch (err) {
                          alert("Failed to generate PDF");
                        }
                      }}
                      className="btn btn-primary"
                      style={{ marginLeft: 8 }}
                    >
                      Generate PDF
                    </a>
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
