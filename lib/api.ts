import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  login: async (emailOrPhone: string, password: string, deviceId: string) => {
    const isEmail = emailOrPhone.includes("@");
    const payload = isEmail
      ? { email: emailOrPhone, password, deviceId }
      : { phone: emailOrPhone, password, deviceId };

    const response = await api.post("/auth/login", payload);
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

// Hoardings API
export const hoardingsAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    city?: string;
    area?: string;
    location?: string;
    type?: string;
    size?: string;
    availability?: string;
    status?: string;
    ownership?: string;
  }) => {
    const response = await api.get("/hoardings", { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/hoardings/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post("/hoardings", data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/hoardings/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/hoardings/${id}`);
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
    const response = await api.get(`/hoardings/${id}/availability`);
    return response.data;
  },

  markUnderProcess: async (id: string) => {
    const response = await api.post(`/hoardings/${id}/under-process`);
    return response.data;
  },

  finalizeStatus: async (
    id: string,
    status: "live" | "booked" | "LIVE" | "BOOKED",
  ) => {
    const response = await api.post(`/hoardings/${id}/finalize-status`, {
      status,
    });
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
  get: async (propertyGroupId: string) => {
    const response = await api.get(`/property-rents/${propertyGroupId}`);
    return response.data;
  },
  save: async (data: any) => {
    const response = await api.post("/property-rents", data);
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

// Proposals API (Phase 2)
export const proposalsAPI = {
  list: async () => {
    const response = await api.get("/proposals");
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/proposals/${id}`);
    return response.data;
  },

  createDraft: async (data: any) => {
    const response = await api.post("/proposals", data);
    return response.data;
  },

  updateDraft: async (id: string, data: any) => {
    const response = await api.patch(`/proposals/${id}`, data);
    return response.data;
  },

  send: async (id: string) => {
    const response = await api.post(`/proposals/${id}/send`);
    return response.data;
  },

  generatePdf: async (id: string) => {
    const response = await api.post(`/proposals/${id}/generate-pdf`);
    return response.data;
  },

  finalize: async (id: string, payload?: { hoardingIds?: string[] }) => {
    const response = await api.post(`/proposals/${id}/finalize`, payload || {});
    return response.data;
  },

  downloadPdf: async (id: string) => {
    const response = await api.get(`/proposals/${id}/pdf`, {
      responseType: "blob",
    });
    return response;
  },
};

// Users API
export const usersAPI = {
  getAll: async () => {
    const response = await api.get("/users");
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

// Roles API
export const rolesAPI = {
  getAll: async () => {
    const response = await api.get("/roles");
    return response.data;
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
    const response = await api.get("/contracts");
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/contracts/${id}`);
    return response.data;
  },
};

// Clients API
export const clientsAPI = {
  getAll: async () => {
    const response = await api.get("/clients");
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

  create: async (data: {
    name: string;
    phone: string;
    email?: string;
    companyName?: string;
  }) => {
    const response = await api.post("/clients", data);
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
    status?: "OPEN" | "LOCKED" | "CLOSED" | string;
    createdByRole?: "owner" | "sales" | string;
  }) => {
    // Backend supports both /enquiries and /inquiries; prefer /inquiries.
    const response = await api.get("/inquiries", { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/inquiries/${id}`);
    return response.data;
  },

  create: async (data: {
    clientName: string;
    phone: string;
    email?: string;
    city: string;
    area: string;
    location: string;
    purpose?: string;
  }) => {
    const response = await api.post("/inquiries", data);
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<{
      clientName: string;
      phone: string;
      email: string | null;
      city: string;
      area: string;
      location: string;
      purpose: string | null;
      status: "OPEN" | "LOCKED" | "CLOSED";
    }>,
  ) => {
    const response = await api.put(`/inquiries/${id}`, data);
    return response.data;
  },
};

// Preferred name (Phase 1 Inquiry System)
export const inquiriesAPI = enquiriesAPI;

// Bookings API
export const bookingsAPI = {
  getAll: async (params?: { createdBy?: string; status?: string }) => {
    const response = await api.get("/bookings", { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/bookings/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post("/bookings", data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/bookings/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/bookings/${id}`);
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
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/booking-tokens/${id}`);
    return response.data;
  },
  confirm: async (
    id: string,
    data?: { executionType?: string; plannedLiveDate?: string },
  ) => {
    const response = await api.post(
      `/booking-tokens/${id}/confirm`,
      data || {},
    );
    return response.data;
  },
  cancel: async (id: string) => {
    const response = await api.post(`/booking-tokens/${id}/cancel`);
    return response.data;
  },
  release: async (id: string) => {
    const response = await api.post(`/booking-tokens/${id}/release`);
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

// Dashboard API
export const dashboardAPI = {
  getOwnerDashboard: async () => {
    const response = await api.get("/dashboard/owner");
    return response.data;
  },

  getManagerDashboard: async () => {
    const response = await api.get("/dashboard/manager");
    return response.data;
  },

  getSalesDashboard: async () => {
    const response = await api.get("/dashboard/sales");
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
  markFit: async (id: string) => {
    const response = await api.put(`/supervisor/hoardings/${id}/mark-fit`);
    return response.data;
  },
  markLive: async (id: string, data?: { liveDate?: string }) => {
    const response = await api.put(
      `/supervisor/hoardings/${id}/mark-live`,
      data || {},
    );
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
};

// Accountant API
export const accountantAPI = {
  summary: async () => {
    const response = await api.get("/accountant/summary");
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
    const response = await api.get("/location/checkins", { params });
    return response.data;
  },
};

export default api;
