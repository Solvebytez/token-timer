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
 * Helper to ensure token is a valid string
 * Returns null if token is invalid/empty (for optional tokens like refresh_token)
 */
function ensureTokenString(token: any, tokenName: string, required: boolean = true): string | null {
  // Handle null/undefined/empty string
  if (!token || token === '') {
    if (required) {
      throw new Error(`${tokenName} is required`);
    }
    return null;
  }
  
  // If it's already a string, validate and return it
  if (typeof token === 'string') {
    // Validate it's not "[object Object]" string
    if (token === '[object Object]' || token.length < 10) {
      if (required) {
        throw new Error(`Invalid ${tokenName} format: token appears to be an object`);
      }
      return null;
    }
    return token;
  }
  
  // If it's an object, try to extract the token value
  if (typeof token === 'object') {
    // Check if it's an empty object
    if (Object.keys(token).length === 0) {
      if (required) {
        throw new Error(`Invalid ${tokenName} format: received empty object`);
      }
      console.warn(`⚠️ ${tokenName} is an empty object, treating as missing`);
      return null;
    }
    
    // Check if it has a token property
    if ('token' in token && typeof token.token === 'string' && token.token.length > 10) {
      return token.token;
    }
    // Check if it has a value property
    if ('value' in token && typeof token.value === 'string' && token.value.length > 10) {
      return token.value;
    }
    
    // If it's an object with stringifiable content, log error
    if (required) {
      console.error(`Invalid ${tokenName}: received object instead of string:`, token);
      throw new Error(`Invalid ${tokenName} format: expected string but received object`);
    }
    console.warn(`⚠️ ${tokenName} is an object but couldn't extract valid token, treating as missing`);
    return null;
  }
  
  // Try to convert to string as last resort
  const stringToken = String(token);
  if (stringToken === '[object Object]' || stringToken.length < 10) {
    if (required) {
      throw new Error(`Invalid ${tokenName} format: cannot convert to valid token string`);
    }
    return null;
  }
  
  return stringToken;
}

/**
 * Set auth cookie for middleware
 */
function setAuthCookie(token: string) {
  if (typeof document !== "undefined") {
    try {
      // Ensure token is a valid string
      const validToken = ensureTokenString(token, 'access_token');
      
      // Set cookie with 15 minutes expiration (matches access token TTL)
      const expires = new Date();
      expires.setMinutes(expires.getMinutes() + 15);
      // Use secure cookie in production, SameSite=Lax for CSRF protection
      const isProduction = process.env.NODE_ENV === 'production';
      const secureFlag = isProduction ? '; Secure' : '';
      document.cookie = `auth_token=${validToken}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${secureFlag}`;
    } catch (error) {
      console.error('❌ Error setting auth_token cookie:', error);
      throw error;
    }
  }
}

/**
 * Set refresh token cookie for middleware
 */
function setRefreshTokenCookie(token: string | null) {
  if (typeof document !== "undefined") {
    // If token is null or empty, don't set the cookie
    if (!token) {
      return;
    }
    
    try {
      // Ensure token is a valid string (refresh token is optional, so don't throw if invalid)
      const validToken = ensureTokenString(token, 'refresh_token', false);
      
      // Only set cookie if we have a valid token
      if (validToken) {
        // Set cookie with 30 days expiration (matches refresh token TTL)
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        // Use secure cookie in production, SameSite=Lax for CSRF protection
        const isProduction = process.env.NODE_ENV === 'production';
        const secureFlag = isProduction ? '; Secure' : '';
        document.cookie = `refresh_token=${validToken}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${secureFlag}`;
      }
    } catch (error) {
      console.error('❌ Error setting refresh_token cookie:', error);
      // Don't throw - refresh token is optional
    }
  }
}

/**
 * Clear auth cookies
 */
function clearAuthCookie() {
  if (typeof document !== "undefined") {
    document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
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
        try {
          // Ensure access token is valid (required)
          const validAccessToken = ensureTokenString(accessToken, 'access_token', true);
          if (!validAccessToken) {
            throw new Error('Access token is required');
          }
          
          // Refresh token is optional - allow null/empty
          const validRefreshToken = ensureTokenString(refreshToken, 'refresh_token', false);
          
          setAuthCookie(validAccessToken);
          // Only set refresh token cookie if we have a valid one
          if (validRefreshToken) {
            setRefreshTokenCookie(validRefreshToken);
          }
          
          set({
            user,
            accessToken: validAccessToken,
            refreshToken: validRefreshToken || null,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('❌ Error setting auth:', error);
          // Clear any partial state on error
          clearAuthCookie();
          throw error;
        }
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
        try {
          setAuthCookie(accessToken);
          // Update refresh token cookie if new refresh token is provided
          if (refreshToken) {
            // Ensure refreshToken is a string before storing
            const validRefreshToken = ensureTokenString(refreshToken, 'refresh_token');
            setRefreshTokenCookie(validRefreshToken);
            set((state) => ({
              accessToken,
              refreshToken: validRefreshToken,
            }));
          } else {
            set((state) => ({
              accessToken,
              refreshToken: state.refreshToken,
            }));
          }
        } catch (error) {
          console.error('❌ Error updating tokens:', error);
          // Clear auth on error to prevent invalid state
          clearAuthCookie();
          throw error;
        }
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
      onRehydrateStorage: () => (state) => {
        // Validate and clean up tokens after rehydration
        // This runs when the store is rehydrated from localStorage
        if (typeof window !== 'undefined' && state) {
          // Check if there are invalid tokens in cookies and clear them
          const cookies = document.cookie.split(';');
          let needsCleanup = false;
          
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'refresh_token' && value) {
              if (value === '[object Object]' || value.length < 10) {
                console.error('❌ Found invalid refresh_token cookie, clearing...');
                document.cookie = "refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                needsCleanup = true;
              }
            }
            if (name === 'auth_token' && value && value === '[object Object]') {
              console.error('❌ Found invalid auth_token cookie, clearing...');
              document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
              needsCleanup = true;
            }
          }
          
          // Validate tokens in rehydrated state
          if (state.refreshToken) {
            const rt = state.refreshToken;
            if (typeof rt !== 'string' || rt === '[object Object]' || rt.length < 10) {
              console.error('❌ Found invalid refreshToken in rehydrated state, clearing...');
              needsCleanup = true;
            }
          }
          
          // If we found invalid data, clear the store
          if (needsCleanup) {
            state.user = null;
            state.accessToken = null;
            state.refreshToken = null;
            state.isAuthenticated = false;
            localStorage.removeItem('auth-storage');
          }
        }
      },
    }
  )
);

