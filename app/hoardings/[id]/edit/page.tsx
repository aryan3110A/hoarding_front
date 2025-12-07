"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import { hoardingsAPI } from "@/lib/api";
import AccessDenied from "@/components/AccessDenied";

export default function EditHoarding() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const user = useUser();
  const userRole = user?.role?.toLowerCase() || "";
  const canEdit = ["owner", "manager", "admin"].includes(userRole);

  const [formData, setFormData] = useState({
    code: "",
    propertyGroupId: "",
    city: "",
    area: "",
    landmark: "",
    roadName: "",
    side: "",
    width: "",
    height: "",
    type: "",
    ownership: "Private",
    status: "available",
    baseRate: "",
    lat: "",
    lng: "",
    landlord: "",
    rateHistoryObj: null as any,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [groupHoardings, setGroupHoardings] = useState<any[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);

  useEffect(() => {
    const fetchHoarding = async () => {
      try {
        const response = await hoardingsAPI.getById(id);
        if (response.success && response.data) {
          const h = response.data;
          setFormData({
            code: h.code || "",
            propertyGroupId: h.propertyGroupId || "",
            city: h.city || "",
            area: h.area || "",
            landmark: h.landmark || "",
            roadName: h.roadName || "",
            side: h.side || "",
            width: h.widthCm ? (h.widthCm / 30.48).toFixed(2) : "",
            height: h.heightCm ? (h.heightCm / 30.48).toFixed(2) : "",
            type: h.type || "",
            ownership: h.ownership || "Private",
            status: h.status || "available",
            baseRate: h.baseRate ? h.baseRate.toString() : "",
            lat: h.lat ? h.lat.toString() : "",
            lng: h.lng ? h.lng.toString() : "",
            landlord: (h.rateHistory && h.rateHistory.landlord) || "",
            rateHistoryObj: h.rateHistory || null,
          });
        }
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to fetch hoarding"
        );
      } finally {
        setFetching(false);
      }
    };

    if (id) {
      fetchHoarding();
    }
  }, [id]);

  // Load sibling hoardings for dropdown once we know propertyGroupId or Location
  useEffect(() => {
    const loadGroup = async () => {
      // We need at least propertyGroupId OR (city + area) to find siblings
      if (!formData.propertyGroupId && (!formData.city || !formData.area)) {
        setGroupHoardings([]);
        return;
      }
      setGroupLoading(true);
      try {
        // Fetch a large page to cover group; optimize later with backend filter
        const resp = await hoardingsAPI.getAll({ page: 1, limit: 500 });
        const all = resp?.data?.hoardings || [];

        let siblings = [];
        if (formData.propertyGroupId) {
          siblings = all.filter(
            (h: any) => h.propertyGroupId === formData.propertyGroupId
          );
        } else {
          // Fallback: Group by City + Area if propertyGroupId is missing
          siblings = all.filter(
            (h: any) =>
              !h.propertyGroupId &&
              h.city === formData.city &&
              h.area === formData.area
          );
        }

        // Sort by code for consistency
        siblings.sort((a: any, b: any) =>
          (a.code || "").localeCompare(b.code || "")
        );
        setGroupHoardings(siblings);
      } catch (e) {
        // swallow for now
      } finally {
        setGroupLoading(false);
      }
    };

    // Only load if we have enough info
    if (formData.propertyGroupId || (formData.city && formData.area)) {
      loadGroup();
    }
  }, [formData.propertyGroupId, formData.city, formData.area]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Convert width and height from feet to cm (1 ft = 30.48 cm)
      const widthCm = formData.width
        ? parseFloat(formData.width) * 30.48
        : null;
      const heightCm = formData.height
        ? parseFloat(formData.height) * 30.48
        : null;

      // Merge landlord into existing rateHistory (preserve other keys)
      const mergedRateHistory = {
        ...(formData.rateHistoryObj || {}),
        ...(formData.landlord ? { landlord: formData.landlord } : {}),
      };

      const updatePayload: any = {
        code: formData.code,
        propertyGroupId: formData.propertyGroupId || null,
        city: formData.city,
        area: formData.area,
        landmark: formData.landmark,
        roadName: formData.roadName,
        side: formData.side || null,
        widthCm: widthCm ? Math.round(widthCm) : null,
        heightCm: heightCm ? Math.round(heightCm) : null,
        type: formData.type || null,
        ownership: formData.ownership,
        status: formData.status,
        baseRate: formData.baseRate ? parseFloat(formData.baseRate) : null,
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
      };

      if (Object.keys(mergedRateHistory).length > 0) {
        updatePayload.rateHistory = mergedRateHistory;
      }

      await hoardingsAPI.update(id, updatePayload);
      router.push(`/hoardings/${id}`);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update hoarding"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!canEdit) {
    return <AccessDenied />;
  }

  if (fetching) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
        <p>Loading hoarding...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <button
          className="btn btn-secondary"
          onClick={() => router.push(`/hoardings/${id}`)}
        >
          ← Back to Hoarding
        </button>
      </div>

      <h1>Edit Hoarding</h1>
      {error && (
        <div
          className="card"
          style={{
            background: "var(--danger-color-light)",
            color: "var(--danger-color)",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "15px",
            }}
          >
            <div className="form-group">
              <label>Property Group ID</label>
              <input
                type="text"
                value={formData.propertyGroupId}
                onChange={(e) =>
                  setFormData({ ...formData, propertyGroupId: e.target.value })
                }
                placeholder="Group identifier (e.g. ABC-ROAD-01)"
              />
            </div>
            {/* Navigation Dropdown for Grouped Hoardings */}
            {groupHoardings.length > 1 && (
              <div
                className="form-group"
                style={{
                  gridColumn: "1 / -1",
                  background: "#f0f9ff",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #bae6fd",
                }}
              >
                <label style={{ color: "#0369a1", fontWeight: "bold" }}>
                  Select Hoarding to Edit
                </label>
                <select
                  value={id}
                  onChange={(e) => {
                    const targetId = e.target.value;
                    if (targetId && targetId !== id) {
                      router.push(`/hoardings/${targetId}/edit`);
                    }
                  }}
                  style={{ borderColor: "#0ea5e9", cursor: "pointer" }}
                >
                  {groupHoardings.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.code} {h.side ? `(${h.side})` : ""}{" "}
                      {h.status === "on_rent" ? "• On Rent" : ""}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#0c4a6e",
                    marginTop: "4px",
                  }}
                >
                  Switching will load the details for the selected hoarding.
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Hoarding Code (Rename)</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                required
                placeholder="e.g., MENG-AH-S"
              />
            </div>
            <div className="form-group">
              <label>City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Area/Zone</label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) =>
                  setFormData({ ...formData, area: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Landmark</label>
              <input
                type="text"
                value={formData.landmark}
                onChange={(e) =>
                  setFormData({ ...formData, landmark: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Landlord</label>
              <input
                type="text"
                value={formData.landlord}
                onChange={(e) =>
                  setFormData({ ...formData, landlord: e.target.value })
                }
                placeholder="Owner / Landlord name"
              />
            </div>
            <div className="form-group">
              <label>Road Name / Facing Direction</label>
              <input
                type="text"
                value={formData.roadName}
                onChange={(e) =>
                  setFormData({ ...formData, roadName: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Side (LHS/RHS)</label>
              <select
                value={formData.side}
                onChange={(e) =>
                  setFormData({ ...formData, side: e.target.value })
                }
              >
                <option value="">None</option>
                <option value="LHS">LHS</option>
                <option value="RHS">RHS</option>
              </select>
            </div>
            <div className="form-group">
              <label>Width (ft)</label>
              <input
                type="number"
                step="0.1"
                value={formData.width}
                onChange={(e) =>
                  setFormData({ ...formData, width: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Height (ft)</label>
              <input
                type="number"
                step="0.1"
                value={formData.height}
                onChange={(e) =>
                  setFormData({ ...formData, height: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Hoarding Type</label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                placeholder="e.g., Gantry, Hoarding"
              />
            </div>
            <div className="form-group">
              <label>Ownership *</label>
              <select
                value={formData.ownership}
                onChange={(e) =>
                  setFormData({ ...formData, ownership: e.target.value })
                }
                required
              >
                <option value="Private">Private</option>
                <option value="Government">Government</option>
                <option value="Friend">Friend</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status *</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                required
              >
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
              </select>
            </div>
            <div className="form-group">
              <label>Base Rate (₹/month)</label>
              <input
                type="number"
                step="0.01"
                value={formData.baseRate}
                onChange={(e) =>
                  setFormData({ ...formData, baseRate: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Latitude</label>
              <input
                type="number"
                step="0.0000001"
                value={formData.lat}
                onChange={(e) =>
                  setFormData({ ...formData, lat: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input
                type="number"
                step="0.0000001"
                value={formData.lng}
                onChange={(e) =>
                  setFormData({ ...formData, lng: e.target.value })
                }
              />
            </div>
          </div>
          <div
            style={{
              marginTop: "20px",
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Hoarding"}
            </button>
            <button
              type="button"
              className="btn btn-warning"
              style={{ padding: "12px 24px" }}
              disabled
            >
              Upload Images (Coming Soon)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push(`/hoardings/${id}`)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
