"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/components/AppLayout";
import { hoardingsAPI } from "@/lib/api";
import { showSuccess, showError } from "@/lib/toast";
import AccessDenied from "@/components/AccessDenied";

type UploadImageItem = {
  id: string;
  file: File;
  url: string;
};

export default function EditHoarding() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
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

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<
    "construction" | "school" | "jewellery" | "flats" | "electronics"
  >("construction");
  const [selectedImages, setSelectedImages] = useState<UploadImageItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openUploadModal = () => {
    setUploadType("construction");
    // reset any previous previews
    setSelectedImages((prev) => {
      for (const item of prev) {
        try {
          URL.revokeObjectURL(item.url);
        } catch (_) {}
      }
      return [];
    });
    setIsDragOver(false);
    setIsUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setSelectedImages((prev) => {
      for (const item of prev) {
        try {
          URL.revokeObjectURL(item.url);
        } catch (_) {}
      }
      return [];
    });
    setIsUploadModalOpen(false);
    setIsDragOver(false);
    setHoveredImageId(null);
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const images = Array.from(files).filter((f) =>
      (f.type || "").toLowerCase().startsWith("image/")
    );
    if (images.length === 0) return;

    setSelectedImages((prev) => {
      const existing = new Set(prev.map((p) => p.id));
      const toAdd: UploadImageItem[] = [];
      for (const file of images) {
        const id = `${file.name}|${file.size}|${file.lastModified}`;
        if (existing.has(id)) continue;
        const url = URL.createObjectURL(file);
        toAdd.push({ id, file, url });
      }
      return [...prev, ...toAdd];
    });
  };

  const removeImage = (id: string) => {
    setSelectedImages((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) {
        try {
          URL.revokeObjectURL(item.url);
        } catch (_) {}
      }
      return prev.filter((p) => p.id !== id);
    });
  };

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
        city: formData.city,
        area: formData.area,
        landmark: formData.landmark,
        roadName: formData.roadName,
        widthCm: widthCm ? Math.round(widthCm) : undefined,
        heightCm: heightCm ? Math.round(heightCm) : undefined,
        type: formData.type || undefined,
        ownership: formData.ownership,
        status: formData.status,
        lat: formData.lat ? parseFloat(formData.lat) : undefined,
        lng: formData.lng ? parseFloat(formData.lng) : undefined,
      };

      // Only include optional fields when they have a meaningful value
      if (formData.side) updatePayload.side = formData.side;
      if (formData.propertyGroupId)
        updatePayload.propertyGroupId = formData.propertyGroupId;
      if (formData.baseRate)
        updatePayload.baseRate = parseFloat(formData.baseRate);

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
          className="btn btn-warning"
          onClick={() => router.push(`/hoardings/${id}`)}
          style={{
            background: "#fb923c",
            borderColor: "#fb923c",
            color: "white",
            boxShadow: "none",
          }}
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
              onClick={openUploadModal}
              disabled={loading}
            >
              Upload Images
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

      {isUploadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeUploadModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 100%)",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <h3 style={{ margin: 0 }}>Upload Images</h3>
              <button
                type="button"
                className="btn btn-primary"
                onClick={closeUploadModal}
              >
                Close
              </button>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as any)}
                >
                  <option value="construction">construction</option>
                  <option value="school">school</option>
                  <option value="jewellery">jewellery</option>
                  <option value="flats">flats</option>
                  <option value="electronics">electronics</option>
                </select>
              </div>

              <div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  style={{
                    border: "2px dashed var(--border-color, #e2e8f0)",
                    borderRadius: "12px",
                    padding: "24px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: isDragOver
                      ? "var(--bg-primary, #f8f9fa)"
                      : "var(--bg-secondary, #ffffff)",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "6px" }}>
                    Drag & drop images here
                  </div>
                  <div
                    style={{ color: "var(--text-secondary)", fontSize: "13px" }}
                  >
                    or click to choose from your device
                  </div>
                  <div
                    style={{
                      marginTop: "10px",
                      color: "var(--text-secondary)",
                      fontSize: "12px",
                    }}
                  >
                    {selectedImages.length > 0
                      ? `${selectedImages.length} image(s) selected`
                      : "No images selected"}
                  </div>
                </div>

                {selectedImages.length > 0 && (
                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    {selectedImages.map((img) => (
                      <div
                        key={img.id}
                        onMouseEnter={() => setHoveredImageId(img.id)}
                        onMouseLeave={() =>
                          setHoveredImageId((cur) =>
                            cur === img.id ? null : cur
                          )
                        }
                        style={{
                          position: "relative",
                          width: "140px",
                          height: "95px",
                          borderRadius: "10px",
                          overflow: "hidden",
                          border: "1px solid var(--border-color, #e2e8f0)",
                          background: "var(--bg-secondary, #ffffff)",
                        }}
                      >
                        <img
                          src={img.url}
                          alt={img.file.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                        {hoveredImageId === img.id && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => removeImage(img.id)}
                            style={{
                              position: "absolute",
                              top: "6px",
                              right: "6px",
                              padding: "2px 8px",
                              fontSize: "12px",
                              lineHeight: 1,
                            }}
                            aria-label="Remove image"
                            title="Remove"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    // allow selecting the same file again later
                    e.currentTarget.value = "";
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    // allow selecting more
                    fileInputRef.current?.click();
                  }}
                >
                  Choose More
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      if (selectedImages.length === 0) {
                        showError("Please select images first");
                        return;
                      }
                      // Create placeholder names: image 1, image 2, ...
                      const filenames = selectedImages.map(
                        (_, idx) => `image ${idx + 1}`
                      );
                      const resp = await hoardingsAPI.addImages(id, {
                        type: uploadType,
                        filenames,
                      });
                      showSuccess("Image saved");
                      closeUploadModal();
                    } catch (e: any) {
                      showError(
                        e?.response?.data?.message ||
                          "Failed to save image metadata"
                      );
                    }
                  }}
                >
                  Save Images
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
