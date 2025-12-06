import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware to handle authentication checks
 * - Protects routes that require authentication
 * - Redirects unauthenticated users to /login
 * - Redirects authenticated users away from /login to home (server-side, no flash)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets and API routes
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Get auth token from cookie
  const authToken = request.cookies.get("auth_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // Define auth routes (login, register, etc.)
  const authRoutes = ["/login"];
  const isAuthRoute = authRoutes.includes(pathname);

  // Define protected routes that require authentication
  const protectedRoutes = ["/"];
  const isProtectedRoute = protectedRoutes.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(route);
  });

  // 1. Handle auth routes - redirect if already authenticated (server-side, no flash)
  if (isAuthRoute && (authToken || refreshToken)) {
    console.log("🔐 Auth route detected with token, validating...");

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      let tokenToUse = authToken || refreshToken;
      let newAccessToken: string | undefined = undefined;
      let newRefreshToken: string | undefined = undefined;

      // Try to validate with current token
      let response = await fetch(`${apiUrl}/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenToUse}`,
        },
      });

      // If access token expired (401), try to refresh it
      if (!response.ok && response.status === 401 && refreshToken) {
        console.log("🔄 Access token expired, attempting to refresh...");

        const refreshResponse = await fetch(`${apiUrl}/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshToken}`,
          },
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.success && refreshData.data?.access_token) {
            newAccessToken = refreshData.data.access_token;
            const newRefreshToken = refreshData.data?.refresh_token;
            tokenToUse = newAccessToken;
            console.log("✅ Token refreshed successfully");

            // Retry /me with new token
            response = await fetch(`${apiUrl}/me`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${newAccessToken}`,
              },
            });
          }
        }
      }

      if (response.ok) {
        const userData = await response.json();
        console.log(
          "✅ Valid token, user is authenticated, redirecting to home"
        );

        // User is authenticated, redirect to home immediately (server-side)
        const redirectResponse = NextResponse.redirect(
          new URL("/", request.url)
        );

        // If we got a new access token, set it in cookie
        if (newAccessToken) {
          const expires = new Date();
          expires.setMinutes(expires.getMinutes() + 15);
          redirectResponse.cookies.set("auth_token", newAccessToken as string, {
            expires: expires,
            path: "/",
            sameSite: "lax",
          });
        }

        // Update refresh token if provided (token rotation)
        if (newRefreshToken) {
          const refreshExpires = new Date();
          refreshExpires.setDate(refreshExpires.getDate() + 30); // 30 days for refresh token
          redirectResponse.cookies.set("refresh_token", newRefreshToken, {
            expires: refreshExpires,
            path: "/",
            sameSite: "lax",
          });
        }

        return redirectResponse;
      } else {
        console.log("❌ Token invalid, allowing access to auth page");
        // Token is invalid, clear cookies and allow access to login page
        const response = NextResponse.next();
        response.cookies.delete("auth_token");
        response.cookies.delete("refresh_token");
        return response;
      }
    } catch (error) {
      console.error("💥 Error validating token:", error);
      // On error, clear cookies and allow access to login page
      const response = NextResponse.next();
      response.cookies.delete("auth_token");
      response.cookies.delete("refresh_token");
      return response;
    }
  }

  // 2. Handle protected routes - redirect to login if not authenticated
  if (isProtectedRoute) {
    // If no tokens at all, redirect to login
    if (!authToken && !refreshToken) {
      console.log(
        "🛡️ Protected route detected, no token found, redirecting to login"
      );
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      // Store the original URL to redirect back after login
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // If access token expired but refresh token exists, try to refresh
    if (!authToken && refreshToken) {
      console.log("🔄 Access token missing, attempting to refresh...");

      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

        const refreshResponse = await fetch(`${apiUrl}/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshToken}`,
          },
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.success && refreshData.data?.access_token) {
            const newAccessToken = refreshData.data.access_token;
            const newRefreshToken = refreshData.data?.refresh_token;
            console.log("✅ Token refreshed successfully in middleware");

            // Set new access token in cookie and allow request to proceed
            const response = NextResponse.next();
            const expires = new Date();
            expires.setMinutes(expires.getMinutes() + 15);
            response.cookies.set("auth_token", newAccessToken, {
              expires: expires,
              path: "/",
              sameSite: "lax",
            });

            // Update refresh token if provided (token rotation)
            if (newRefreshToken) {
              const refreshExpires = new Date();
              refreshExpires.setDate(refreshExpires.getDate() + 30); // 30 days for refresh token
              response.cookies.set("refresh_token", newRefreshToken, {
                expires: refreshExpires,
                path: "/",
                sameSite: "lax",
              });
            }

            return response;
          }
        }

        // Refresh failed, redirect to login
        console.log("❌ Token refresh failed, redirecting to login");
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        const response = NextResponse.redirect(url);
        response.cookies.delete("auth_token");
        response.cookies.delete("refresh_token");
        return response;
      } catch (error) {
        console.error("💥 Error refreshing token:", error);
        // On error, redirect to login
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        const response = NextResponse.redirect(url);
        response.cookies.delete("auth_token");
        response.cookies.delete("refresh_token");
        return response;
      }
    }
  }

  // Allow the request to proceed
  return NextResponse.next();
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
