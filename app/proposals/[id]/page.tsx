"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ProposalDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLiked, setSelectedLiked] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    const load = async () => {
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers: any = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const resp = await fetch(`${API}/api/proposals/${id}`, { headers });
        const data = await resp.json();
        if (resp.ok) setProposal(data.data);
      } catch (e) {}
      setLoading(false);
    };
    if (id) load();
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (!proposal) return <div>Not found</div>;

  const toggleLike = (hoardingId: string) => {
    setSelectedLiked((s) => ({ ...s, [hoardingId]: !s[hoardingId] }));
  };

  const generatePdf = async () => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(`${API}/api/proposals/pdf`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        hoardings: (proposal?.hoardings || []).map((h: any) => h.hoardingId),
        client: { name: proposal.client?.name },
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
    } else alert("Failed to generate PDF");
  };

  return (
    <div
      style={{
        backgroundColor: "#00b7e6",
        color: "#fff",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28 }}>Proposal for {proposal.client?.name}</h1>
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: 12,
            marginTop: 12,
          }}
        >
          {(proposal?.hoardings || []).map((ph: any) => (
            <div
              key={ph.id}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                padding: 8,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ width: 96, height: 64, background: "#f4f4f4" }}>
                {ph.hoarding?.images?.[0] ? (
                  <img
                    src={ph.hoarding.images[0]}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : null}
              </div>
              <div style={{ flex: 1 }}>
                <div>
                  <strong style={{ color: "#fff" }}>{ph.hoarding?.code}</strong>
                </div>
                <div style={{ color: "rgba(255,255,255,0.85)" }}>
                  {[ph.hoarding?.city, ph.hoarding?.area, ph.hoarding?.landmark]
                    .filter(Boolean)
                    .join(", ")}
                </div>
                <div style={{ color: "rgba(255,255,255,0.85)" }}>
                  Status: {ph.hoarding?.status}
                </div>
              </div>
              <div>
                <label style={{ color: "#fff" }}>
                  <input
                    type="checkbox"
                    checked={!!selectedLiked[ph.hoardingId]}
                    onChange={() => toggleLike(ph.hoardingId)}
                  />{" "}
                  Client Interested
                </label>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={generatePdf}
            className="btn btn-primary"
            style={{ padding: "8px 12px" }}
          >
            Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
}
