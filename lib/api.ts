import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
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
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          });
          
          const { accessToken } = response.data.data;
          localStorage.setItem('token', accessToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, logout user
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (emailOrPhone: string, password: string, deviceId: string) => {
    const isEmail = emailOrPhone.includes('@');
    const payload = isEmail
      ? { email: emailOrPhone, password, deviceId }
      : { phone: emailOrPhone, password, deviceId };
    
    const response = await api.post('/auth/login', payload);
    return response.data;
  },
  
  refresh: async (refreshToken: string) => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  },
  
  logout: async (refreshToken: string) => {
    const response = await api.post('/auth/logout', { refreshToken });
    return response.data;
  },
};

// Hoardings API
export const hoardingsAPI = {
  getAll: async (params?: { page?: number; limit?: number; city?: string; area?: string; status?: string }) => {
    const response = await api.get('/hoardings', { params });
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/hoardings/${id}`);
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/hoardings', data);
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
  
  getAvailability: async (id: string) => {
    const response = await api.get(`/hoardings/${id}/availability`);
    return response.data;
  },
};

// Rent API
export const rentAPI = {
  getRentDetails: async (hoardingId: string) => {
    const response = await api.get(`/hoardings/${hoardingId}/rent`);
    return response.data;
  },
  
  saveRent: async (hoardingId: string, data: any) => {
    const response = await api.post(`/hoardings/${hoardingId}/rent`, data);
    return response.data;
  },
  
  recalculateRent: async (hoardingId: string) => {
    const response = await api.post(`/hoardings/${hoardingId}/rent/recalculate`);
    return response.data;
  },
};

// Dashboard API
export const dashboardAPI = {
  getOwnerDashboard: async () => {
    const response = await api.get('/dashboard/owner');
    return response.data;
  },
};

// Bookings API
export const bookingsAPI = {
  getAll: async () => {
    const response = await api.get('/bookings');
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },
  
  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
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
    const response = await api.post('/reminders/send', { days });
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getAll: async () => {
    const response = await api.get('/users');
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/users', data);
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
    const response = await api.get('/roles');
    return response.data;
  },
  
  getById: async (id: number) => {
    const response = await api.get(`/roles/${id}`);
    return response.data;
  },
  
  create: async (data: { name: string }) => {
    const response = await api.post('/roles', data);
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

// Enquiries API
export const enquiriesAPI = {
  getAll: async () => {
    const response = await api.get('/enquiries');
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/enquiries', data);
    return response.data;
  },
  
  update: async (id: string, data: any) => {
    const response = await api.put(`/enquiries/${id}`, data);
    return response.data;
  },
};

// Contracts API
export const contractsAPI = {
  getAll: async () => {
    const response = await api.get('/contracts');
    return response.data;
  },
};

// Clients API
export const clientsAPI = {
  getAll: async () => {
    const response = await api.get('/clients');
    return response.data;
  },
};

export default api;






