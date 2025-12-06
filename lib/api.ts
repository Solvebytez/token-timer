import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

// API Base URL - Update this to match your Laravel backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * Create axios instance with default config
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

/**
 * Request interceptor - Automatically add auth token to requests
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get access token from auth store
    const accessToken = useAuthStore.getState().accessToken;
    
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle token refresh and errors
 */
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If token expired (401) and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { refreshToken } = useAuthStore.getState();
        
        if (!refreshToken) {
          // No refresh token, clear auth
          useAuthStore.getState().clearAuth();
          return Promise.reject(error);
        }

        // Try to refresh the token
        const response = await axios.post(`${API_BASE_URL}/refresh`, {}, {
          headers: {
            'Authorization': `Bearer ${refreshToken}`,
          },
        });

        // Handle response structure
        if (response.data.success && response.data.data) {
          const { access_token, refresh_token } = response.data.data;
          
          if (!access_token) {
            throw new Error('No access token in refresh response');
          }
          
          // Update tokens in store
          useAuthStore.getState().updateTokens(access_token, refresh_token || refreshToken);

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          
          return apiClient(originalRequest);
        } else {
          throw new Error('Invalid refresh response structure');
        }
      } catch (refreshError: any) {
        // Refresh failed, clear auth
        console.error('❌ Token refresh failed in interceptor:', refreshError);
        useAuthStore.getState().clearAuth();
        
        // If we're in the browser, redirect to login
        if (typeof window !== 'undefined') {
          // Only redirect if not already on login page
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

