import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
}

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateTokens: (accessToken: string, refreshToken?: string) => void;
}

/**
 * Set auth cookie for middleware
 */
function setAuthCookie(token: string) {
  if (typeof document !== "undefined") {
    // Set cookie with 15 minutes expiration (matches access token TTL)
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);
    // Use secure cookie in production, SameSite=Lax for CSRF protection
    const isProduction = process.env.NODE_ENV === 'production';
    const secureFlag = isProduction ? '; Secure' : '';
    document.cookie = `auth_token=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${secureFlag}`;
  }
}

/**
 * Clear auth cookie
 */
function clearAuthCookie() {
  if (typeof document !== "undefined") {
    document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      // Set authentication data
      setAuth: (user: User, accessToken: string, refreshToken: string) => {
        setAuthCookie(accessToken);
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      // Clear authentication data
      clearAuth: () => {
        clearAuthCookie();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      // Update tokens (for refresh)
      updateTokens: (accessToken: string, refreshToken?: string) => {
        setAuthCookie(accessToken);
        set((state) => ({
          accessToken,
          refreshToken: refreshToken || state.refreshToken,
        }));
      },
    }),
    {
      name: "auth-storage", // localStorage key
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

