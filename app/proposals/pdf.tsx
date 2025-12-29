"use client";
import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import ReactDOM from "react-dom";
import { showSuccess, showError } from "../../lib/toast";

interface Hoarding {
  id: string;
  code: string;
  location?: string;
  city?: string;
  area?: string;
  size?: string;
  widthCm?: number | null;
  heightCm?: number | null;
  status?: string;
  thumbnail?: string;
}

const GenerateProposalPDF: React.FC = () => {
  const [hoardings, setHoardings] = useState<Hoarding[]>([]);
  const [selectedHoardings, setSelectedHoardings] = useState<string[]>([]);
  const [clients, setClients] = useState<
    Array<{ id: string; name: string; phone?: string }>
  >([]);
  const [clientDropdownOpen, setClientDropdownOpen] = useState<boolean>(false);
  const [clientSearch, setClientSearch] = useState<string>("");
  const clientButtonRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const [hoardingPage, setHoardingPage] = useState<number>(1);
  const [hoardingLimit] = useState<number>(20);
  const [creatingClient, setCreatingClient] = useState<boolean>(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState<{
    name: string;
    phone?: string;
    email?: string;
    companyName?: string;
  }>({
    name: "",
    phone: "",
    email: "",
    companyName: "",
  });

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  useEffect(() => {
    fetchClients();
    fetchHoardings(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (clientDropdownOpen && clientButtonRef.current) {
      setDropdownRect(clientButtonRef.current.getBoundingClientRect());
    }

    const onUpdate = () => {
      if (clientDropdownOpen && clientButtonRef.current) {
        setDropdownRect(clientButtonRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener("resize", onUpdate);
    window.addEventListener("scroll", onUpdate, true);
    return () => {
      window.removeEventListener("resize", onUpdate);
      window.removeEventListener("scroll", onUpdate, true);
    };
  }, [clientDropdownOpen]);

  const fetchClients = async () => {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch(`${API}/api/clients`, { headers });
      const json = await resp.json();
      if (resp.status === 401) {
        // not authenticated - ask user to login
        console.warn("Clients fetch returned 401");
        return setClients([]);
      }
      const data = json?.data || json || [];
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchClients", e);
    }
  };

  const fetchHoardings = async (page: number) => {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch(
        `${API}/api/hoardings?page=${page}&limit=${hoardingLimit}`,
        { headers }
      );
      const json = await resp.json();
      if (resp.status === 401) {
        console.warn("Hoardings fetch returned 401");
        return;
      }
      // support different response shapes
      const data =
        json?.data?.hoardings || json?.data || json?.hoardings || json || [];
      const items = Array.isArray(data) ? data : data.items || [];
      if (page === 1) setHoardings(items);
      else setHoardings((s) => [...s, ...items]);
    } catch (e) {
      console.error("fetchHoardings", e);
    }
  };

  const loadMoreHoardings = async () => {
    const next = hoardingPage + 1;
    await fetchHoardings(next);
    setHoardingPage(next);
  };

  const handleCreateProposal = async (): Promise<string | null> => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const clientPayload = creatingClient
      ? newClient
      : clients.find((c) => c.id === selectedClientId);
    if (!clientPayload || !selectedHoardings.length) {
      showError("Provide client and at least one hoarding");
      return null;
    }
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const resp = await fetch(`${API}/api/proposals`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          client: clientPayload,
          hoardings: selectedHoardings,
        }),
      });
      if (!resp.ok) {
        showError("Failed to save proposal");
        return null;
      }
      const j = await resp.json();
      const id = j?.data?.id || j?.id || j?.proposal?.id || null;
      return id;
    } catch (e) {
      console.error(e);
      showError("Failed to save proposal");
      return null;
    }
  };

  const handleGeneratePDF = async () => {
    // create proposal first (silent)
    const id = await handleCreateProposal();
    if (!id) return;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    try {
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch(`${API}/api/proposals/${id}/pdf`, { headers });
      if (!resp.ok) {
        showError("Failed to generate PDF");
        return;
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposal-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showSuccess("PDF generated successfully");
    } catch (e) {
      console.error(e);
      showError("Failed to download PDF");
    }
  };

  return (
    <div className="min-h-screen text-white py-0 transition-all duration-300">
      <div className="max-w-ful mx-auto px-0">
        <h1 className="text-4xl font-extrabold mb-6 drop-shadow">
          Generate Proposal PDF
        </h1>

        <div className="bg-white/5 rounded-lg p-6 mb-6 shadow-sm backdrop-blur">
          <h2 className="text-2xl font-semibold text-white mb-4">Client</h2>
          <div className="flex items-center gap-6 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!creatingClient}
                onChange={() => {
                  setCreatingClient(false);
                }}
                className="accent-sky-300"
              />
              <span className="text-white">Use existing</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={creatingClient}
                onChange={() => {
                  setCreatingClient(true);
                  setSelectedClientId(null);
                }}
                className="accent-sky-300"
              />
              <span className="text-white">Create new</span>
            </label>
          </div>

          {!creatingClient ? (
            <div className="form-group cool-dropdown relative">
              <label className="sr-only">Select client</label>
              <button
                type="button"
                ref={clientButtonRef}
                onClick={() => setClientDropdownOpen((s) => !s)}
                className="cool-dropdown-button text-left w-full bg-white p-3 rounded-md"
                aria-expanded={clientDropdownOpen}
              >
                {selectedClientId
                  ? (clients.find((c) => c.id === selectedClientId)?.name ||
                      "") +
                    " — " +
                    (clients.find((c) => c.id === selectedClientId)?.phone ||
                      "")
                  : " Select client "}
                <span className="cool-dropdown-chevron">▸</span>
              </button>

              {/* dropdown will render via portal to avoid stacking context issues */}
            </div>
          ) : (
            <div className="flex gap-3">
              <input
                placeholder="Name"
                value={newClient.name}
                onChange={(e) =>
                  setNewClient({ ...newClient, name: e.target.value })
                }
                className="flex-1 rounded-md p-3  border border-white/20 text-black"
              />
              <input
                placeholder="Phone"
                value={newClient.phone}
                onChange={(e) =>
                  setNewClient({ ...newClient, phone: e.target.value })
                }
                className="w-48 rounded-md p-3  border border-white/20 text-black"
              />
              <input
                placeholder="Email"
                value={newClient.email}
                onChange={(e) =>
                  setNewClient({ ...newClient, email: e.target.value })
                }
                className="w-72 rounded-md p-3  border border-white/20 text-black"
              />
              <input
                placeholder="Company"
                value={newClient.companyName}
                onChange={(e) =>
                  setNewClient({ ...newClient, companyName: e.target.value })
                }
                className="w-72 rounded-md p-3  border border-white/20 text-black"
              />
            </div>
          )}
        </div>

        <div className="bg-white/10 rounded-lg p-6 shadow-sm backdrop-blur z-0">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Select Hoardings
          </h2>

          <div className="mb-4">
            <label className="block text-sm text-white mb-2">
              Choose hoardings
            </label>
            <div className="w-full  border bg-white/80 border-white/20 rounded-md p-0 text-black">
              <div className="grid md:grid-cols-6 gap-2 px-4 py-3  bg-white/80 text-black font-semibold sticky top-0">
                <div className="col-span-1">Select</div>
                <div className="col-span-1">Code</div>
                <div className="col-span-1">City</div>
                <div className="col-span-2">Location / Area</div>
                <div className="col-span-1">Size</div>
              </div>
              <div className="max-h-64 overflow-auto">
                {(hoardings || []).map((h) => {
                  const checked = selectedHoardings.includes(h.id);
                  return (
                    <div
                      key={h.id}
                      className="grid md:grid-cols-6 gap-2 px-4 py-3 odd:bg-white/3 even:bg-white/2 items-center"
                    >
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedHoardings((s) =>
                              checked
                                ? s.filter((id) => id !== h.id)
                                : [...s, h.id]
                            );
                          }}
                          className="h-4 w-4"
                        />
                      </div>
                      <div className="col-span-1 text-sm text-slate-800">
                        {h.code}
                      </div>
                      <div className="col-span-1 text-sm text-slate-600">
                        {h.city || "-"}
                      </div>
                      <div className="col-span-2 text-sm text-slate-600">
                        {[h.location, h.area].filter(Boolean).join(" | ") ||
                          "-"}
                      </div>
                      <div className="col-span-1 text-sm text-slate-600">
                        {(h.size && String(h.size).trim()) ||
                          (h.widthCm != null && h.heightCm != null
                            ? `${Math.round(
                                (h.widthCm || 0) / 30.48
                              )}ft x ${Math.round((h.heightCm || 0) / 30.48)}ft`
                            : "-")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-sm text-white/80 mt-2">
              Tip: use the checkboxes to select hoardings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadMoreHoardings}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-md transition"
            >
              Load more hoardings
            </button>
            <div className="text-sm text-white/80">
              Showing page {hoardingPage}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={async () => {
              await handleCreateProposal();
            }}
            className="bg-white text-sky-600 font-semibold px-4 py-2 rounded-md shadow hover:scale-105 transition-transform"
          >
            Save Proposal
          </button>
          <button
            onClick={handleGeneratePDF}
            className="bg-sky-700 text-white font-semibold px-4 py-2 rounded-md shadow hover:scale-105 transition-transform"
          >
            Generate PDF
          </button>
        </div>
      </div>
      {clientDropdownOpen && dropdownRect && typeof document !== "undefined"
        ? ReactDOM.createPortal(
            <div
              className="cool-dropdown-list bg-white rounded-md p-2 shadow-lg max-h-64 overflow-auto"
              style={{
                position: "absolute",
                top: dropdownRect.bottom + window.scrollY + 8,
                left: dropdownRect.left + window.scrollX,
                width: dropdownRect.width,
                zIndex: 99999,
              }}
            >
              <div className="px-2 pb-2">
                <input
                  placeholder="Search client..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div>
                {clients
                  .filter((c) =>
                    clientSearch.trim()
                      ? (c.name || "")
                          .toLowerCase()
                          .includes(clientSearch.toLowerCase()) ||
                        (c.phone || "").includes(clientSearch)
                      : true
                  )
                  .map((c) => (
                    <div
                      key={c.id}
                      className="cool-dropdown-item flex items-center justify-between px-3 py-2 hover:bg-sky-50 cursor-pointer"
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setClientDropdownOpen(false);
                      }}
                    >
                      <div className="text-sm text-slate-800">{c.name}</div>
                      <div className="text-sm text-slate-500">{c.phone}</div>
                    </div>
                  ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

export default GenerateProposalPDF;
