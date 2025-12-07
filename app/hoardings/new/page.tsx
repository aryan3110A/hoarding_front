"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// AppLayout is provided at the root; do not wrap pages again.
import { hoardingsAPI } from "@/lib/api";

export default function NewHoarding() {
  const [formData, setFormData] = useState({
    code: "",
    propertyGroupId: "", // NEW: groups multiple hoardings under one property
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
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

      await hoardingsAPI.create({
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
      });
      router.push("/hoardings");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to create hoarding"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <button
          className="btn btn-secondary"
          onClick={() => router.push("/hoardings")}
        >
          ← Back to Hoardings
        </button>
      </div>

      <h1>Add New Hoarding</h1>
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
              <label>Property Group ID (to group hoardings)</label>
              <input
                type="text"
                value={formData.propertyGroupId}
                onChange={(e) =>
                  setFormData({ ...formData, propertyGroupId: e.target.value })
                }
                placeholder="e.g., ABC-ROAD-01"
              />
            </div>
            <div className="form-group">
              <label>Hoarding Code *</label>
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
          <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Hoarding"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/hoardings")}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
