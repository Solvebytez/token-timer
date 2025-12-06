"use client";

import type React from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api-services";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { setAuth } = useAuthStore();

  // Note: Middleware handles redirecting authenticated users server-side
  // No need for client-side redirect here

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      console.log("Mutation function called", { email });
      try {
        const response = await authApi.login(email, password);
        console.log("Login API response:", response);
        return response;
      } catch (error) {
        console.error("Login API error:", error);
        throw error;
      }
    },
    onSuccess: (response) => {
      console.log("Login success:", response);
      if (response.success && response.data) {
        const { user, access_token, refresh_token } = response.data;
        
        console.log("Storing auth data...");
        // Store authentication data
        setAuth(user, access_token, refresh_token);
        
        // Clear any previous errors
        setError(null);
        
        // Redirect to home or the original destination
        const redirect = searchParams.get("redirect") || "/";
        console.log("Redirecting to:", redirect);
        // Use replace to avoid back button issues
        router.replace(redirect);
      } else {
        const errorMsg = response.message || "Login failed. Please try again.";
        console.error("Login failed:", errorMsg);
        setError(errorMsg);
      }
    },
    onError: (error: any) => {
      console.error("Login mutation error:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response,
        request: error.request,
      });
      
      // Handle API errors
      if (error.response?.data) {
        const apiError = error.response.data;
        console.error("API error response:", apiError);
        if (apiError.errors) {
          // Validation errors
          const firstError = Object.values(apiError.errors)[0];
          setError(Array.isArray(firstError) ? firstError[0] : String(firstError));
        } else {
          setError(apiError.message || apiError.error || "Login failed. Please try again.");
        }
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response from server");
        setError("Cannot connect to server. Please check if the backend is running.");
      } else {
        // Something else happened
        console.error("Request setup error:", error.message);
        setError(error.message || "Network error. Please check your connection and try again.");
      }
    },
  });

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log("Form submitted", { email, password });
    setError(null);
    
    // Validate inputs
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    console.log("Calling login API...");
    // Trigger login mutation
    loginMutation.mutate({ email, password });
  };

  const handleButtonClick = () => {
    console.log("Button clicked", { email, password, isPending: loginMutation.isPending });
    handleSubmit();
  };

  return (
    <div className="min-h-screen bg-retro-beige flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-retro-dark mb-2">
            Token Tracker
          </h1>
          <p className="text-retro-dark/70">Sign in to continue</p>
        </div>

        {/* Login Card */}
        <div className="bg-retro-cream border-4 border-retro-dark p-8 rounded-lg">
          <form 
            onSubmit={handleSubmit} 
            className="space-y-6"
            noValidate
          >
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-bold text-retro-dark mb-2"
              >
                EMAIL
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loginMutation.isPending}
                className="w-full px-4 py-3 bg-white border-3 border-retro-dark text-retro-dark font-bold text-lg rounded focus:outline-none focus:ring-2 focus:ring-retro-accent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-bold text-retro-dark mb-2"
              >
                PASSWORD
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loginMutation.isPending}
                className="w-full px-4 py-3 bg-white border-3 border-retro-dark text-retro-dark font-bold text-lg rounded focus:outline-none focus:ring-2 focus:ring-retro-accent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm font-bold">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="button"
              onClick={handleButtonClick}
              disabled={loginMutation.isPending}
              className="w-full bg-retro-accent border-4 border-retro-dark text-retro-dark font-bold text-lg py-3 rounded-lg hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loginMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  LOGGING IN...
                </>
              ) : (
                "LOGIN"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-retro-dark/60">
            Token Tracker Authentication
          </p>
        </div>
      </div>
    </div>
  );
}

