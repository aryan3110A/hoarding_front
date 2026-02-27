"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { hoardingsAPI } from "@/lib/api";
import { showError } from "@/lib/toast";

function extractLandlordName(hoarding: any) {
  const history =
    hoarding?.rateHistory && typeof hoarding.rateHistory === "object"
      ? hoarding.rateHistory
      : {};
  const fromHistory =
    (history as any)?.landlordName || (history as any)?.landlord || "";
  if (String(fromHistory).trim()) return String(fromHistory).trim();

  const ownership = String(hoarding?.ownership || "");
  const match = ownership.match(/^(gov|govt|government)\s*-\s*(.+)$/i);
  if (match && match[2]) return String(match[2]).trim();

  return "";
}

export default function DeprecatedHoardingRentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hoardingId = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [landlordName, setLandlordName] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await hoardingsAPI.getById(hoardingId);
        if (response?.success && response.data) {
          setLandlordName(extractLandlordName(response.data));
        }
      } catch (error: any) {
        showError(error?.response?.data?.message || "Failed to load hoarding");
      } finally {
        setLoading(false);
      }
    };

    if (hoardingId) load();
  }, [hoardingId]);

  const targetPath = useMemo(() => {
    if (!landlordName) return "/hoardings";
    return `/landlords/${encodeURIComponent(landlordName)}/rent`;
  }, [landlordName]);

  return (
    <div className="card" style={{ maxWidth: "760px", margin: "0 auto" }}>
      <h2>Hoarding-Level Rent is Deprecated</h2>
      {loading ? (
        <p>Loading landlord mapping...</p>
      ) : (
        <>
          <p>
            Rent now belongs to landlord only. Hoardings can only reference
            landlord rent configuration.
          </p>
          {landlordName ? (
            <p>
              <strong>Mapped landlord:</strong> {landlordName}
            </p>
          ) : (
            <p>No landlord mapping found for this hoarding.</p>
          )}
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button
              className="btn btn-primary"
              onClick={() => router.push(targetPath)}
            >
              Open Landlord Rent Editor
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => router.push(`/hoardings/${hoardingId}`)}
            >
              Back to Hoarding
            </button>
          </div>
        </>
      )}
    </div>
  );
}
