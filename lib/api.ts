import axios from "axios";
import { clearAuthCookie } from "@/lib/auth-cookie";
import {
  HOARDING_AVAILABILITY_STALE_MS,
  HOARDING_CATALOG_LIMIT,
  HOARDING_DETAIL_STALE_MS,
  HOARDING_LIST_STALE_MS,
  HOARDING_LOOKUP_STALE_MS,
  clearQueryCache,
  invalidateCategoryQueries,
  invalidateHoardingQueries,
  invalidateResource,
  isQueryFresh,
  isUnfilteredHoardingQuery,
  normalizeQueryParams,
  readThroughCache,
  scopedQueryKey,
} from "@/lib/query-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SALES_IDLE_STORAGE_KEY = "salesLastActivityAt";

async function cachedGet(
  resource: string,
  path: string,
  params?: object,
  staleTime = HOARDING_LIST_STALE_MS,
) {
  const normalized = normalizeQueryParams(params);
  return readThroughCache({
    queryKey: scopedQueryKey([resource, "list", normalized]),
    staleTime,
    queryFn: async () => {
      const response = await api.get(
        path,
        Object.keys(normalized).length ? { params: normalized } : undefined,
      );
      return response.data;
    },
  });
}

function sliceHoardingCatalog(body: any, page: number, limit: number) {
  const rows = body?.data?.hoardings;
  if (!Array.isArray(rows) || !limit) return body;
  const total = Number(body?.data?.total ?? rows.length);
  const start = (Math.max(page, 1) - 1) * limit;
  if (start > 0 && start >= rows.length && rows.length < total) return null;
  return {
    ...body,
    data: {
      ...body.data,
      hoardings: rows.slice(start, start + limit),
      page: Math.max(page, 1),
      limit,
      total,
    },
  };
}

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data.data;
          localStorage.setItem("token", accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, logout user
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          localStorage.removeItem(SALES_IDLE_STORAGE_KEY);
          clearAuthCookie();
          clearQueryCache();
          window.location.href = "/login";
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  login: async (
    emailOrPhone: string,
    password: string,
    deviceId: string,
    deviceMeta?: { deviceName?: string; platform?: string },
  ) => {
    const isEmail = emailOrPhone.includes("@");
    const payload = isEmail
      ? { email: emailOrPhone, password, deviceId, ...deviceMeta }
      : { phone: emailOrPhone, password, deviceId, ...deviceMeta };

    const response = await api.post("/auth/login", payload);
    return response.data;
  },

  getSession: async () => {
    const response = await api.get("/auth/session");
    return response.data;
  },

  refresh: async (refreshToken: string) => {
    const response = await api.post("/auth/refresh", { refreshToken });
    return response.data;
  },

  logout: async (refreshToken: string) => {
    const response = await api.post("/auth/logout", { refreshToken });
    return response.data;
  },
};

export function isHoardingListFresh(params?: object | null) {
  const normalized = normalizeQueryParams(params);
  const key = isUnfilteredHoardingQuery(normalized)
    ? scopedQueryKey(["hoardings", "catalog"])
    : scopedQueryKey(["hoardings", "list", normalized]);
  return isQueryFresh(key, HOARDING_LIST_STALE_MS);
}

// Hoardings API
export const hoardingsAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    city?: string;
    area?: string;
    landmark?: string;
    categoryId?: string;
    location?: string;
    type?: string;
    size?: string;
    availability?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    ownership?: string;
  }) => {
    const normalized = normalizeQueryParams(params);
    if (isUnfilteredHoardingQuery(normalized)) {
      const page = Number(normalized.page || 1);
      const limit = Number(normalized.limit || 0);
      const catalog = await readThroughCache({
        queryKey: scopedQueryKey(["hoardings", "catalog"]),
        staleTime: HOARDING_LIST_STALE_MS,
        queryFn: async () => {
          const response = await api.get("/hoardings", {
            params: { page: 1, limit: HOARDING_CATALOG_LIMIT },
          });
          return response.data;
        },
      });
      return sliceHoardingCatalog(catalog, page, limit) || catalog;
    }
    return readThroughCache({
      queryKey: scopedQueryKey(["hoardings", "list", normalized]),
      staleTime: HOARDING_LIST_STALE_MS,
      queryFn: async () => {
        const response = await api.get("/hoardings", { params: normalized });
        return response.data;
      },
    });
  },

  getById: async (id: string) => {
    return readThroughCache({
      queryKey: scopedQueryKey(["hoardings", "detail", id]),
      staleTime: HOARDING_DETAIL_STALE_MS,
      queryFn: async () => {
        const response = await api.get(`/hoardings/${id}`);
        return response.data;
      },
    });
  },

  nextCode: async () => {
    const response = await api.get("/hoardings/next-code");
    return response.data;
  },

  getCities: async () => {
    return readThroughCache({
      queryKey: scopedQueryKey(["hoardings", "cities"]),
      staleTime: HOARDING_LOOKUP_STALE_MS,
      queryFn: async () => {
        const response = await api.get("/hoardings/cities");
        return response.data;
      },
    });
  },

  getLandmarks: async () => {
    return readThroughCache({
      queryKey: scopedQueryKey(["hoardings", "landmarks"]),
      staleTime: HOARDING_LOOKUP_STALE_MS,
      queryFn: async () => {
        const response = await api.get("/hoardings/landmarks");
        return response.data;
      },
    });
  },

  getTypes: async () => {
    return readThroughCache({
      queryKey: scopedQueryKey(["hoardings", "types"]),
      staleTime: HOARDING_LOOKUP_STALE_MS,
      queryFn: async () => {
        const response = await api.get("/hoardings/types");
        return response.data;
      },
    });
  },

  create: async (data: any) => {
    const response = await api.post("/hoardings", data);
    await invalidateHoardingQueries();
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/hoardings/${id}`, data);
    await invalidateHoardingQueries();
    return response.data;
  },

  delete: async (id: string, mode?: "recycle" | "permanent") => {
    const response = await api.delete(`/hoardings/${id}`, { params: { mode } });
    await invalidateHoardingQueries();
    await invalidateResource("recycle-bin");
    return response.data;
  },

  addImages: async (
    id: string,
    data: { type: string; filenames: string[] },
  ) => {
    const response = await api.post(`/hoardings/${id}/images`, data);
    return response.data;
  },

  getAvailability: async (id: string) => {
    return readThroughCache({
      queryKey: scopedQueryKey(["hoardings", "availability", id]),
      staleTime: HOARDING_AVAILABILITY_STALE_MS,
      queryFn: async () => {
        const response = await api.get(`/hoardings/${id}/availability`);
        return response.data;
      },
    });
  },

  markUnderProcess: async (id: string) => {
    const response = await api.post(`/hoardings/${id}/under-process`);
    await invalidateHoardingQueries();
    return response.data;
  },

  finalizeStatus: async (
    id: string,
    status:
      | "live"
      | "booked"
      | "blocked"
      | "available"
      | "LIVE"
      | "BOOKED"
      | "BLOCKED"
      | "AVAILABLE",
  ) => {
    const response = await api.post(`/hoardings/${id}/finalize-status`, {
      status,
    });
    await invalidateHoardingQueries();
    return response.data;
  },

  listRemountRenew: async () => {
    return cachedGet("hoardings-remount", "/hoardings/remount-renew/list", undefined, 60 * 1000);
  },

  requestRemount: async (id: string) => {
    const response = await api.post(`/hoardings/${id}/remount-request`);
    await invalidateHoardingQueries();
    return response.data;
  },

  sendSupervisorNotification: async (id: string) => {
    const response = await api.post(`/hoardings/${id}/notify-supervisor`);
    return response.data;
  },

  completeRemount: async (id: string) => {
    const response = await api.post(`/hoardings/${id}/remount-complete`);
    await invalidateHoardingQueries();
    return response.data;
  },

  renew: async (
    id: string,
    data: { tenure: number; newAmount: number; remountRequired: boolean },
  ) => {
    const response = await api.post(`/hoardings/${id}/renew`, data);
    await invalidateHoardingQueries();
    return response.data;
  },

  getRenewalHistory: async (id: string) => {
    const response = await api.get(`/hoardings/${id}/renewal-history`);
    return response.data;
  },
};

// Landlords API
export const landlordsAPI = {
  list: async (params?: { q?: string }) => {
    return cachedGet("landlords", "/landlords", params);
  },

  groupedHoardings: async (params?: { q?: string }) => {
    const response = await api.get("/landlords/hoardings", { params });
    return response.data;
  },

  create: async (data: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  }) => {
    const response = await api.post("/landlords", data);
    await invalidateResource("landlords");
    return response.data;
  },
};

// Categories API
export const categoriesAPI = {
  list: async () => {
    return readThroughCache({
      queryKey: scopedQueryKey(["categories", "list"]),
      staleTime: HOARDING_LOOKUP_STALE_MS,
      queryFn: async () => {
        const response = await api.get("/categories");
        return response.data;
      },
    });
  },
  create: async (data: { name: string }) => {
    const response = await api.post("/categories", data);
    await invalidateCategoryQueries();
    return response.data;
  },
};

// Rent API
export const rentAPI = {
  getAll: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get("/hoardings/rents/all", { params });
    return response.data;
  },

  getRentDetails: async (hoardingId: string) => {
    const response = await api.get(`/hoardings/${hoardingId}/rent`);
    return response.data;
  },

  saveRent: async (hoardingId: string, data: any) => {
    const response = await api.post(`/hoardings/${hoardingId}/rent`, data);
    return response.data;
  },

  recalculateRent: async (hoardingId: string) => {
    const response = await api.post(
      `/hoardings/${hoardingId}/rent/recalculate`,
    );
    return response.data;
  },
};

// Property Rent API (property-level consolidated rent)
export const propertyRentAPI = {
  summary: async () => {
    const response = await api.get("/property-rents/summary");
    return response.data;
  },
  list: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get("/property-rents", { params });
    return response.data;
  },
  dueBoard: async () => {
    const response = await api.get("/property-rents/due-board");
    return response.data;
  },
  paymentTotals: async () => {
    const response = await api.get("/property-rents/payment-totals");
    return response.data;
  },
  pay: async (formData: FormData) => {
    const response = await api.post("/property-rents/pay", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
  get: async (propertyGroupId: string) => {
    const response = await api.get(`/property-rents/${propertyGroupId}`);
    return response.data;
  },
  getByLandlord: async (landlordName: string) => {
    const response = await api.get(
      `/property-rents/by-landlord/${encodeURIComponent(landlordName)}`,
    );
    return response.data;
  },
  save: async (data: any) => {
    const response = await api.post("/property-rents", data);
    return response.data;
  },
};

export const maintenanceAPI = {
  types: async () => {
    return cachedGet("maintenance", "/maintenance/types", undefined, HOARDING_LOOKUP_STALE_MS);
  },
  list: async (params?: { page?: number; limit?: number }) => {
    return cachedGet("maintenance", "/maintenance", params);
  },
  listByHoarding: async (hoardingId: string) => {
    const response = await api.get(`/maintenance/hoarding/${hoardingId}`);
    return response.data;
  },
  create: async (formData: FormData) => {
    const response = await api.post("/maintenance", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get("/notifications", { params });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get("/notifications/unread-count");
    return response.data;
  },

  markAsRead: async (id: string) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },
};

// Reminders API
export const remindersAPI = {
  sendReminders: async (days: number = 7) => {
    const response = await api.post("/reminders/send", { days });
    return response.data;
  },
};

// Locations API
export const locationsAPI = {
  suggestions: async (q: string) => {
    const response = await api.get("/locations/suggestions", { params: { q } });
    return response.data;
  },
};

// Proposals API (Phase 2)
export const proposalsAPI = {
  list: async () => {
    return cachedGet("proposals", "/proposals");
  },

  getById: async (id: string) => {
    const response = await api.get(`/proposals/${id}`);
    return response.data;
  },

  createDraft: async (data: any) => {
    const response = await api.post("/proposals", data);
    await invalidateResource("proposals");
    return response.data;
  },

  updateDraft: async (id: string, data: any) => {
    const response = await api.patch(`/proposals/${id}`, data);
    await invalidateResource("proposals");
    return response.data;
  },

  send: async (id: string) => {
    const response = await api.post(`/proposals/${id}/send`);
    await invalidateResource("proposals");
    return response.data;
  },

  generatePdf: async (id: string) => {
    const response = await api.post(`/proposals/${id}/generate-pdf`);
    return response.data;
  },

  finalize: async (
    id: string,
    payload?: { hoardingIds?: string[]; finalRates?: Record<string, number> },
  ) => {
    const response = await api.post(`/proposals/${id}/finalize`, payload || {});
    await invalidateResource("proposals");
    await invalidateHoardingQueries();
    return response.data;
  },

  downloadPdf: async (id: string) => {
    const response = await api.get(`/proposals/${id}/pdf`, {
      responseType: "blob",
    });
    return response;
  },

  requestRateApproval: async (
    proposalId: string,
    data: { hoardingId: string; proposedRate: number; reason: string; remarks?: string },
  ) => {
    const response = await api.post(`/proposals/${proposalId}/rate-approval`, data);
    return response.data;
  },

  listPendingRateApprovals: async () => {
    const response = await api.get("/proposals/rate-approvals/pending");
    return response.data;
  },

  approveRateApproval: async (requestId: string, remarks?: string) => {
    const response = await api.post(`/proposals/rate-approvals/${requestId}/approve`, { remarks });
    return response.data;
  },

  rejectRateApproval: async (requestId: string, remarks?: string) => {
    const response = await api.post(`/proposals/rate-approvals/${requestId}/reject`, { remarks });
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getAll: async () => {
    return cachedGet("users", "/users", undefined, HOARDING_LOOKUP_STALE_MS);
  },

  getSalesDeviceStatus: async () => {
    const response = await api.get("/users/sales/device-status");
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post("/users", data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};

export const devicesAPI = {
  ping: async (
    deviceId: string,
    data: { lat: number; lng: number; accuracy?: number },
  ) => {
    const response = await api.post(`/devices/${deviceId}/ping`, data);
    return response.data;
  },
};

// Roles API
export const rolesAPI = {
  getAll: async () => {
    return cachedGet("roles", "/roles", undefined, HOARDING_LOOKUP_STALE_MS);
  },

  getById: async (id: number) => {
    const response = await api.get(`/roles/${id}`);
    return response.data;
  },

  create: async (data: { name: string }) => {
    const response = await api.post("/roles", data);
    return response.data;
  },

  update: async (id: number, data: { name: string }) => {
    const response = await api.put(`/roles/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/roles/${id}`);
    return response.data;
  },
};

// Contracts API
export const contractsAPI = {
  getAll: async () => {
    return cachedGet("contracts", "/contracts");
  },
  getById: async (id: string) => {
    const response = await api.get(`/contracts/${id}`);
    return response.data;
  },
  getRenewalsDue: async (days: number = 15) => {
    const response = await api.get("/contracts/renewals-due", {
      params: { days },
    });
    return response.data;
  },
  sendRenewalReminder: async (id: string) => {
    const response = await api.post(`/contracts/${id}/send-renewal-reminder`);
    return response.data;
  },
};

// Clients API
export const clientsAPI = {
  getAll: async () => {
    return cachedGet("clients", "/clients");
  },

  byPhone: async (phone: string) => {
    const response = await api.get("/clients/by-phone", { params: { phone } });
    return response.data;
  },

  search: async (q: string, limit: number = 10) => {
    const response = await api.get("/clients/search", { params: { q, limit } });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  upsertBillingProfile: async (
    id: string,
    data: {
      billingCompanyName?: string;
      billingPhone?: string;
      billingEmail?: string;
      gstin?: string;
      billingAddress?: string;
    },
  ) => {
    const response = await api.patch(`/clients/${id}/billing-profile`, data);
    return response.data;
  },

  create: async (data: {
    name: string;
    phone: string;
    email?: string;
    companyName?: string;
    billingAddress?: string;
  }) => {
    const response = await api.post("/clients", data);
    await invalidateResource("clients");
    return response.data;
  },

  getHistory: async (id: string) => {
    const response = await api.get(`/clients/${id}/history`);
    return response.data;
  },
};

// Tasks API
export const tasksAPI = {
  getAll: async (params?: {
    assignedTo?: string;
    type?: string;
    status?: string;
  }) => {
    const response = await api.get("/tasks", { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/tasks/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post("/tasks", data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/tasks/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  },

  updateStatus: async (id: string, status: string) => {
    const response = await api.put(`/tasks/${id}/status`, { status });
    return response.data;
  },
};

// Design Assignments API
export const designAssignmentsAPI = {
  getAll: async (params?: { designerId?: string; status?: string }) => {
    const response = await api.get("/design-assignments", { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/design-assignments/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post("/design-assignments", data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/design-assignments/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/design-assignments/${id}`);
    return response.data;
  },
};

// Enquiries API
export const enquiriesAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    q?: string;
    city?: string;
    area?: string;
    location?: string;
    categoryId?: string;
    assignedSalesId?: string;
    assignedToMe?: boolean;
    status?: "OPEN" | "LOCKED" | "CLOSED" | string;
    performanceStage?:
    | "IN_PROCESS"
    | "WON"
    | "FOLLOW_UP_LATER"
    | "DEAD"
    | "NOT_INTERESTED"
    | string;
    createdByRole?: "owner" | "sales" | string;
  }) => {
    return cachedGet("inquiries", "/inquiries", params);
  },

  getById: async (id: string) => {
    const response = await api.get(`/inquiries/${id}`);
    return response.data;
  },

  create: async (data: {
    clientName: string;
    companyName?: string;
    phone: string;
    email?: string;
    city: string;
    area: string;
    location: string;
    purpose?: string;
    firstContactDate?: string;
    nextFollowupDate?: string;
    followupStatus?: "PENDING" | "DONE";
    performanceStage?:
    | "IN_PROCESS"
    | "WON"
    | "FOLLOW_UP_LATER"
    | "DEAD"
    | "NOT_INTERESTED"
    | string;
    source:
    | "WALK_IN"
    | "SELF_GENERATED"
    | "VIA_TELEPHONIC"
    | "VIA_WHATSAPP"
    | "REFERENCE"
    | "OTHERS"
    | string;
    assignedSalesId?: string;
    categoryId?: string;
  }) => {
    const response = await api.post("/inquiries", data);
    await invalidateResource("inquiries");
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<{
      clientName: string;
      companyName: string | null;
      phone: string;
      email: string | null;
      city: string;
      area: string;
      location: string;
      purpose: string | null;
      firstContactDate: string | null;
      nextFollowupDate: string | null;
      followupStatus: "PENDING" | "DONE";
      performanceStage:
      | "IN_PROCESS"
      | "WON"
      | "FOLLOW_UP_LATER"
      | "DEAD"
      | "NOT_INTERESTED";
      assignedSalesId: string | null;
      categoryId: string | null;
      status: "OPEN" | "LOCKED" | "CLOSED";
    }>,
  ) => {
    const response = await api.put(`/inquiries/${id}`, data);
    await invalidateResource("inquiries");
    return response.data;
  },

  getReminders: async (params?: { range?: "today" | "next7" | "all" }) => {
    const response = await api.get("/inquiries/reminders", { params });
    return response.data;
  },

  assignSales: async (id: string, assignedSalesId?: string | null) => {
    const response = await api.put(`/inquiries/${id}/assign-sales`, {
      assignedSalesId: assignedSalesId ?? null,
    });
    return response.data;
  },

  listSalesUsers: async () => {
    return cachedGet("inquiries", "/inquiries/sales-users", undefined, HOARDING_LOOKUP_STALE_MS);
  },
};

// Preferred name (Phase 1 Inquiry System)
export const inquiriesAPI = enquiriesAPI;

// Bookings API
export const bookingsAPI = {
  getAll: async (params?: { createdBy?: string; status?: string }) => {
    return cachedGet("bookings", "/bookings", params);
  },

  getById: async (id: string) => {
    const response = await api.get(`/bookings/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post("/bookings", data);
    await invalidateHoardingQueries();
    await invalidateResource("bookings");
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/bookings/${id}`, data);
    await invalidateHoardingQueries();
    await invalidateResource("bookings");
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/bookings/${id}`);
    await invalidateHoardingQueries();
    await invalidateResource("bookings");
    return response.data;
  },
};

// Booking Tokens API
export const bookingTokensAPI = {
  create: async (data: {
    hoardingId: string;
    dateFrom: string;
    // either provide durationMonths OR dateTo (legacy)
    durationMonths?: number;
    dateTo?: string;
    notes?: string;
    client?: {
      name: string;
      phone: string;
      email?: string;
      companyName?: string;
    };
  }) => {
    const response = await api.post("/booking-tokens", data);
    await invalidateHoardingQueries();
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/booking-tokens/${id}`);
    return response.data;
  },
  confirm: async (
    id: string,
    data?: {
      executionType?: string;
      plannedLiveDate?: string;
      durationMonths?: number;
      durationDays?: number;
      paymentPlanType?: string;
      billingFrequency?: string;
      gstApplicable?: boolean;
      finalAgreedBasePrice?: number;
      modeOfPayment?: string;
      printingChargesBase?: number;
      mountingChargesBase?: number;
      poRequired?: boolean;
      poNotes?: string;
      expectedPoDate?: string;
      billingCompanyName?: string;
      billingPhone?: string;
      billingEmail?: string;
      gstin?: string;
      billingAddress?: string;
    },
  ) => {
    const response = await api.post(
      `/booking-tokens/${id}/confirm`,
      data || {},
    );
    await invalidateHoardingQueries();
    return response.data;
  },
  cancel: async (id: string) => {
    const response = await api.post(`/booking-tokens/${id}/cancel`);
    await invalidateHoardingQueries();
    return response.data;
  },
  release: async (id: string) => {
    const response = await api.post(`/booking-tokens/${id}/release`);
    await invalidateHoardingQueries();
    return response.data;
  },
  requestExtension: async (id: string) => {
    const response = await api.post(`/booking-tokens/${id}/request-extension`);
    return response.data;
  },
  approveExtension: async (id: string) => {
    const response = await api.post(`/booking-tokens/${id}/approve-extension`);
    return response.data;
  },
  rejectExtension: async (id: string) => {
    const response = await api.post(`/booking-tokens/${id}/reject-extension`);
    return response.data;
  },
  mine: async () => {
    const response = await api.get("/booking-tokens/mine");
    return response.data;
  },
  assigned: async () => {
    const response = await api.get("/booking-tokens/assigned");
    return response.data;
  },
  assignedInstallations: async () => {
    const response = await api.get("/booking-tokens/assigned-installations");
    return response.data;
  },
  updateDesignStatus: async (id: string, status: string) => {
    const response = await api.put(`/booking-tokens/${id}/design-status`, {
      status,
    });
    return response.data;
  },
  fitters: async () => {
    const response = await api.get("/booking-tokens/fitters");
    return response.data;
  },
  designers: async () => {
    const response = await api.get("/booking-tokens/designers");
    return response.data;
  },
  assignFitter: async (id: string, data?: { fitterId?: string }) => {
    const response = await api.put(
      `/booking-tokens/${id}/assign-fitter`,
      data || {},
    );
    return response.data;
  },
  updateFitterStatus: async (id: string, status: string) => {
    const response = await api.put(`/booking-tokens/${id}/fitter-status`, {
      status,
    });
    return response.data;
  },

  completeInstallation: async (id: string, files: File[]) => {
    const form = new FormData();
    (files || []).forEach((f) => form.append("images", f));
    const response = await api.post(
      `/booking-tokens/${id}/complete-installation`,
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },
};

// Blocked Hoardings Dashboard API
export const blockedHoardingsAPI = {
  byClient: async (params?: { q?: string }) => {
    const response = await api.get("/blocked-hoardings/by-client", { params });
    return response.data;
  },
};

// Dashboard API
export const dashboardAPI = {
  getOwnerDashboard: async () => {
    return cachedGet("dashboard", "/dashboard/owner", undefined, 60 * 1000);
  },

  getManagerDashboard: async () => {
    return cachedGet("dashboard", "/dashboard/manager", undefined, 60 * 1000);
  },

  getSalesDashboard: async () => {
    return cachedGet("dashboard", "/dashboard/sales", undefined, 60 * 1000);
  },

  getSalesPerformance: async (params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: "day" | "month" | string;
    salespersonId?: string;
  }) => {
    const response = await api.get("/dashboard/sales-performance", { params });
    return response.data;
  },

  getSalesPerformanceClients: async (params?: {
    startDate?: string;
    endDate?: string;
    salespersonId?: string;
  }) => {
    const response = await api.get("/dashboard/sales-performance/clients", {
      params,
    });
    return response.data;
  },

  getSalesMarketVisits: async (params?: {
    startDate?: string;
    endDate?: string;
    salespersonId?: string;
  }) => {
    const response = await api.get(
      "/dashboard/sales-performance/market-visits",
      {
        params,
      },
    );
    return response.data;
  },

  saveSalesMarketVisit: async (data?: {
    visitDate?: string;
    visitedMarket?: boolean;
    notes?: string | null;
  }) => {
    const response = await api.post(
      "/dashboard/sales-performance/market-visits",
      data || {},
    );
    return response.data;
  },

  getDesignerDashboard: async () => {
    const response = await api.get("/dashboard/designer");
    return response.data;
  },

  getFitterDashboard: async () => {
    const response = await api.get("/dashboard/fitter");
    return response.data;
  },
};

// Supervisor API
export const supervisorAPI = {
  getExecutionBoard: async (params?: {
    tab?: "pending" | "live" | "remounting" | "unmounting" | string;
    page?: number;
    limit?: number;
    clientName?: string;
    city?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const response = await api.get("/supervisor/execution-board", { params });
    return response.data;
  },

  listHoardings: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    sizeMatch?: string;
    condition?: string;
    materialReceived?: string;
  }) => {
    const response = await api.get("/supervisor/hoardings", { params });
    return response.data;
  },
  listDesigners: async () => {
    const response = await api.get("/supervisor/designers");
    return response.data;
  },
  updateChecklist: async (
    id: string,
    data: {
      isCorrectSize?: boolean;
      isGoodCondition?: boolean;
      isFlexReceived?: boolean;
      isReadyForInstall?: boolean;
    },
  ) => {
    const response = await api.put(
      `/supervisor/hoardings/${id}/checklist`,
      data,
    );
    return response.data;
  },
  setExecutionType: async (
    id: string,
    data: { executionType: string; designerId?: string },
  ) => {
    const response = await api.put(
      `/supervisor/hoardings/${id}/execution-type`,
      data,
    );
    return response.data;
  },
  uploadChecklistImage: async (id: string, files: File[]) => {
    const form = new FormData();
    (files || []).forEach((f) => form.append("images", f));
    const response = await api.post(
      `/supervisor/hoardings/${id}/checklist-image`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },

  uploadExecutionImages: async (
    id: string,
    type: "mount" | "remount" | "unmount",
    files: File[],
  ) => {
    const form = new FormData();
    form.append("type", type);
    (files || []).forEach((f) => form.append("images", f));
    const response = await api.post(
      `/supervisor/hoardings/${id}/execution-images`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },

  updateExecutionStatus: async (
    id: string,
    status:
      | "pending"
      | "received"
      | "live"
      | "remount_pending"
      | "remounted"
      | "unmount_pending"
      | "unmounted",
  ) => {
    const response = await api.put(
      `/supervisor/hoardings/${id}/execution-status`,
      {
        status,
      },
    );
    await invalidateHoardingQueries();
    return response.data;
  },
  markFit: async (id: string) => {
    const response = await api.put(`/supervisor/hoardings/${id}/mark-fit`);
    return response.data;
  },
  markLive: async (id: string, data?: { liveDate?: string }) => {
    const response = await api.put(
      `/supervisor/hoardings/${id}/mark-live`,
      data || {},
    );
    await invalidateHoardingQueries();
    return response.data;
  },
  markLiveWithBilling: async (
    id: string,
    data?: {
      liveDate?: string;
      billingStartDate?: string;
      billingPeriodOverrideNote?: string;
    },
  ) => {
    const response = await api.put(
      `/supervisor/hoardings/${id}/mark-live`,
      data || {},
    );
    await invalidateHoardingQueries();
    return response.data;
  },
  setLiveDate: async (id: string, data: { plannedLiveDate: string }) => {
    const response = await api.put(
      `/supervisor/hoardings/${id}/live-date`,
      data,
    );
    return response.data;
  },
  markRemoval: async (id: string, reason: string) => {
    const response = await api.put(`/supervisor/hoardings/${id}/mark-removal`, {
      reason,
    });
    return response.data;
  },
  getOperationalPdf: async (id: string) => {
    const response = await api.get(`/supervisor/hoardings/${id}/pdf`, {
      responseType: "blob",
    });
    return response;
  },

  completeRemount: async (id: string) => {
    const response = await api.post(`/hoardings/${id}/remount-complete`);
    await invalidateHoardingQueries();
    return response.data;
  },
};

// Accountant API
export const accountantAPI = {
  summary: async () => {
    const response = await api.get("/accountant/summary");
    return response.data;
  },
  getBillingQueue: async (params?: {
    tab?: "to_be_generated" | "pending" | "overdue" | "completed" | string;
    clientId?: string;
  }) => {
    const response = await api.get("/accountant/billing-queue", { params });
    return response.data;
  },
  listFirms: async () => {
    const response = await api.get("/accountant/firms");
    return response.data;
  },
  markBillingEventPoPending: async (id: string) => {
    const response = await api.post(
      `/accountant/billing-events/${id}/po-pending`,
    );
    return response.data;
  },
  generateBill: async (data: {
    eventIds: string[];
    firmName: string;
    billNumber: string;
    remarks?: string;
    billPdf?: File | null;
  }) => {
    const form = new FormData();
    form.append("eventIds", JSON.stringify(data.eventIds || []));
    form.append("firmName", data.firmName);
    form.append("billNumber", data.billNumber);
    if (data.remarks) form.append("remarks", data.remarks);
    if (data.billPdf) form.append("billPdf", data.billPdf);
    const response = await api.post("/accountant/bills/generate", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
  listInvoices: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    clientId?: string;
    contractId?: string;
    search?: string;
  }) => {
    const response = await api.get("/accountant/invoices", { params });
    return response.data;
  },
  createInvoice: async (data: any) => {
    const response = await api.post("/accountant/invoices", data);
    return response.data;
  },
  updateInvoice: async (id: string, data: any) => {
    const response = await api.patch(`/accountant/invoices/${id}`, data);
    return response.data;
  },
  recordPayment: async (invoiceId: string, data: any) => {
    const response = await api.post(
      `/accountant/invoices/${invoiceId}/payments`,
      data,
    );
    return response.data;
  },
  listPayments: async (params?: {
    page?: number;
    limit?: number;
    invoiceId?: string;
  }) => {
    const response = await api.get("/accountant/payments", { params });
    return response.data;
  },
  getPaymentTracking: async (params?: { search?: string }) => {
    const response = await api.get("/accountant/payment-tracking", { params });
    return response.data;
  },
  scheduleInvoiceReminder: async (
    invoiceId: string,
    data: { reminderAt: string; reminderNote?: string },
  ) => {
    const response = await api.post(
      `/accountant/invoices/${invoiceId}/reminder`,
      data,
    );
    return response.data;
  },
  listPrintingExpenses: async (params?: {
    page?: number;
    limit?: number;
    contractId?: string;
    clientId?: string;
  }) => {
    const response = await api.get("/accountant/printing-expenses", { params });
    return response.data;
  },
  createPrintingExpense: async (data: any) => {
    const response = await api.post("/accountant/printing-expenses", data);
    return response.data;
  },
};

// Location Tracking API
export const locationAPI = {
  checkIn: async (data: {
    latitude: number;
    longitude: number;
    hoardingId?: string;
  }) => {
    const response = await api.post("/location/check-in", data);
    return response.data;
  },

  getMyCheckIns: async (params?: { startDate?: string; endDate?: string }) => {
    const response = await api.get("/location/my-checkins", { params });
    return response.data;
  },

  getAllCheckIns: async (params?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    return cachedGet("location", "/location/checkins", params, 60 * 1000);
  },
};

// Recycle Bin API
export const recycleBinAPI = {
  list: async () => {
    return cachedGet("recycle-bin", "/recycle-bin", undefined, 30 * 1000);
  },
  restore: async (id: string) => {
    const response = await api.post(`/recycle-bin/${id}/restore`);
    await invalidateResource("recycle-bin");
    await invalidateHoardingQueries();
    return response.data;
  },
  purge: async (id: string) => {
    const response = await api.delete(`/recycle-bin/${id}`);
    return response.data;
  },
};

// Todos API
export const todosAPI = {
  list: async () => {
    return cachedGet("todos", "/todos");
  },
  create: async (data: {
    title: string;
    description?: string;
    dueDate?: string;
    visibility?: string;
    roleName?: string;
    tags?: string;
  }) => {
    const response = await api.post("/todos", data);
    await invalidateResource("todos");
    return response.data;
  },
  update: async (
    id: string,
    data: {
      title?: string;
      description?: string;
      dueDate?: string | null;
      status?: string;
      visibility?: string;
      roleName?: string;
      tags?: string | null;
    }
  ) => {
    const response = await api.patch(`/todos/${id}`, data);
    await invalidateResource("todos");
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/todos/${id}`);
    await invalidateResource("todos");
    return response.data;
  },
};

export default api;
