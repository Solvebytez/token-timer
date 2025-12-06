import apiClient from './api';
import type { AxiosResponse } from 'axios';

/**
 * API Response Types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  error?: string;
}

export interface LoginResponse {
  user: {
    id: number;
    name: string;
    email: string;
    role?: string;
  };
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface TokenDataPayload {
  timeSlotId: string;
  date: string;
  timeSlot: string;
  entries: Array<{
    number: number;
    quantity: number;
    timestamp: number;
  }>;
  counts: Record<number, number>;
  timestamp: string;
}

/**
 * Authentication API Services
 */
export const authApi = {
  /**
   * Login user
   */
  login: async (email: string, password: string): Promise<ApiResponse<LoginResponse>> => {
    const response: AxiosResponse<ApiResponse<LoginResponse>> = await apiClient.post('/login', {
      email,
      password,
    });
    return response.data;
  },

  /**
   * Register user
   */
  register: async (
    name: string,
    email: string,
    password: string,
    password_confirmation: string
  ): Promise<ApiResponse<LoginResponse>> => {
    const response: AxiosResponse<ApiResponse<LoginResponse>> = await apiClient.post('/register', {
      name,
      email,
      password,
      password_confirmation,
    });
    return response.data;
  },

  /**
   * Refresh access token
   */
  refresh: async (refreshToken: string): Promise<ApiResponse<{ access_token: string }>> => {
    const response: AxiosResponse<ApiResponse<{ access_token: string }>> = await apiClient.post(
      '/refresh',
      {},
      {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      }
    );
    return response.data;
  },

  /**
   * Get current user
   */
  me: async (): Promise<ApiResponse<{ user: LoginResponse['user'] }>> => {
    const response: AxiosResponse<ApiResponse<{ user: LoginResponse['user'] }>> = await apiClient.get('/me');
    return response.data;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await apiClient.post('/logout');
    return response.data;
  },
};

/**
 * Token Data API Services
 */
export const tokenDataApi = {
  /**
   * Save token data
   */
  save: async (data: TokenDataPayload): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await apiClient.post('/token-data', data);
    return response.data;
  },

  /**
   * Get token data by date
   */
  getByDate: async (date: string): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await apiClient.get(`/token-data/date/${date}`);
    return response.data;
  },

  /**
   * Get token data by date range
   */
  getByDateRange: async (startDate: string, endDate: string): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await apiClient.get('/token-data/range', {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });
    return response.data;
  },

  /**
   * Get all token data with pagination and filters
   */
  getAll: async (params?: {
    page?: number;
    per_page?: number;
    start_date?: string;
    end_date?: string;
    time_slot?: string;
  }): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await apiClient.get('/token-data', {
      params,
    });
    return response.data;
  },

  /**
   * Update token data by ID
   */
  update: async (id: number, data: { entries: Array<{ number: number; quantity: number; timestamp: number }> }): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await apiClient.put(`/token-data/${id}`, data);
    return response.data;
  },

  /**
   * Delete token data by ID
   */
  delete: async (id: number): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await apiClient.delete(`/token-data/${id}`);
    return response.data;
  },
};

