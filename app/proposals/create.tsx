import React, { useState } from "react";
import { useRouter } from "next/router";

interface Client {
  name: string;
  phone: string;
  email: string;
  companyName: string;
}

interface Hoarding {
  id: string;
  code: string;
  location: string;
}

const CreateProposal = () => {
  const router = useRouter();
  const [client, setClient] = useState<Client>({
    name: "",
    phone: "",
    email: "",
    companyName: "",
  });
  const [hoardings, setHoardings] = useState<Hoarding[]>([]);
  const [selectedHoardings, setSelectedHoardings] = useState<string[]>([]);

  const handleClientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setClient({ ...client, [name]: value });
  };

  const handleHoardingSelection = (hoardingId: string) => {
    setSelectedHoardings((prev) =>
      prev.includes(hoardingId)
        ? prev.filter((id) => id !== hoardingId)
        : [...prev, hoardingId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${API}/api/proposals`, {
        method: "POST",
        headers,
        body: JSON.stringify({ client, hoardings: selectedHoardings }),
      });
      const data = await response.json();
      if (response.ok) {
        router.push("/proposals");
      } else {
        alert(data?.message || "Failed to create proposal");
      }
    } catch (err) {
      alert("Failed to create proposal");
    }
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
        <h1 style={{ fontSize: 32 }}>Create Proposal</h1>
        <form
          onSubmit={handleSubmit}
          style={{
            background: "rgba(255,255,255,0.06)",
            padding: 16,
            borderRadius: 8,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <label>Client Name</label>
            <input
              type="text"
              name="name"
              value={client.name}
              onChange={handleClientChange}
              required
            />
          </div>
          <div>
            <label>Phone</label>
            <input
              type="text"
              name="phone"
              value={client.phone}
              onChange={handleClientChange}
              required
            />
          </div>
          <div>
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={client.email}
              onChange={handleClientChange}
            />
          </div>
          <div>
            <label>Company Name</label>
            <input
              type="text"
              name="companyName"
              value={client.companyName}
              onChange={handleClientChange}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <h2>Select Hoardings</h2>
            {(hoardings || []).map((hoarding) => (
              <div key={hoarding.id}>
                <input
                  type="checkbox"
                  checked={selectedHoardings.includes(hoarding.id)}
                  onChange={() => handleHoardingSelection(hoarding.id)}
                />
                <span>
                  {hoarding.code} - {hoarding.location}
                </span>
              </div>
            ))}
          </div>

          <button type="submit" style={{ padding: "8px 12px" }}>
            Save Proposal
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateProposal;
