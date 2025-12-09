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
  let refreshToken = request.cookies.get("refresh_token")?.value;

  // IMMEDIATELY validate and clear invalid refresh tokens
  // This prevents "[object Object]" from persisting in cookies
  if (refreshToken) {
    if (
      typeof refreshToken !== "string" ||
      refreshToken === "[object Object]" ||
      refreshToken.length < 10
    ) {
      console.error(
        "❌ Invalid refresh token detected, clearing immediately:",
        refreshToken
      );
      // Clear the invalid cookie immediately
      refreshToken = undefined;
      // If we're on a protected route, redirect to login and clear cookies
      if (
        pathname !== "/login" &&
        !pathname.startsWith("/_next/") &&
        !pathname.startsWith("/api/")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        const redirectResponse = NextResponse.redirect(url);
        redirectResponse.cookies.delete("refresh_token");
        redirectResponse.cookies.delete("auth_token");
        return redirectResponse;
      }
      // For non-protected routes, just clear cookies and continue
      const response = NextResponse.next();
      response.cookies.delete("refresh_token");
      response.cookies.delete("auth_token");
      return response;
    }
  }

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

  // Debug logging for protected routes
  if (isProtectedRoute) {
    console.log("🔍 Middleware Debug:", {
      pathname,
      hasAuthToken: !!authToken,
      hasRefreshToken: !!refreshToken,
      authTokenLength: authToken?.length || 0,
      refreshTokenLength: refreshToken?.length || 0,
    });
  }

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
            // Ensure refresh token is a string if provided
            const refreshTokenRaw = refreshData.data?.refresh_token;
            newRefreshToken = refreshTokenRaw
              ? typeof refreshTokenRaw === "string"
                ? refreshTokenRaw
                : String(refreshTokenRaw)
              : undefined;
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
          // Ensure refresh token is a string
          const validRefreshToken =
            typeof newRefreshToken === "string"
              ? newRefreshToken
              : String(newRefreshToken);

          // Validate it's not "[object Object]"
          if (
            validRefreshToken === "[object Object]" ||
            validRefreshToken.length < 10
          ) {
            console.error(
              "❌ Invalid refresh token format in middleware:",
              newRefreshToken
            );
          } else {
            const refreshExpires = new Date();
            refreshExpires.setDate(refreshExpires.getDate() + 30); // 30 days for refresh token
            redirectResponse.cookies.set("refresh_token", validRefreshToken, {
              expires: refreshExpires,
              path: "/",
              sameSite: "lax",
            });
          }
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

    // Validate access token if it exists, or refresh if missing/expired
    let shouldRefresh = false;
    let newAccessToken: string | undefined = undefined;
    let newRefreshToken: string | undefined = undefined;

    // If we have an access token, validate it first
    if (authToken) {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

        const validateResponse = await fetch(`${apiUrl}/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (validateResponse.ok) {
          // Access token is valid, allow request to proceed
          console.log("✅ Access token is valid");
          return NextResponse.next();
        } else if (validateResponse.status === 401 && refreshToken) {
          // Access token expired, need to refresh
          console.log("🔄 Access token expired, attempting to refresh...");
          shouldRefresh = true;
        } else {
          // Token invalid for other reasons, try refresh if available
          if (refreshToken) {
            console.log("🔄 Access token invalid, attempting to refresh...");
            shouldRefresh = true;
          } else {
            // No refresh token, redirect to login
            console.log("❌ Access token invalid and no refresh token");
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            const response = NextResponse.redirect(url);
            response.cookies.delete("auth_token");
            response.cookies.delete("refresh_token");
            return response;
          }
        }
      } catch (error) {
        console.error("💥 Error validating access token:", error);
        // On error, try refresh if available
        if (refreshToken) {
          shouldRefresh = true;
        } else {
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          const response = NextResponse.redirect(url);
          response.cookies.delete("auth_token");
          response.cookies.delete("refresh_token");
          return response;
        }
      }
    } else {
      // No access token, try to refresh if refresh token exists
      shouldRefresh = true;
    }

    // If access token is missing or expired, try to refresh
    if (shouldRefresh) {
      // Check if we have a valid refresh token
      if (
        !refreshToken ||
        typeof refreshToken !== "string" ||
        refreshToken === "[object Object]" ||
        refreshToken.length < 50
      ) {
        // No valid refresh token available - user needs to re-login
        console.log(
          "❌ Access token expired and no valid refresh token available"
        );
        console.log(
          "   User needs to re-login. This is expected if backend didn't provide refresh token."
        );
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        const response = NextResponse.redirect(url);
        response.cookies.delete("auth_token");
        response.cookies.delete("refresh_token");
        return response;
      }

      // We have a valid refresh token, proceed with refresh
      console.log("🔄 Access token missing/expired, attempting to refresh...");
      console.log(
        "🔑 Refresh token preview:",
        refreshToken.substring(0, 20) + "..."
      );

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

        console.log("🔄 Refresh response status:", refreshResponse.status);

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          console.log(
            "🔄 Refresh response data:",
            JSON.stringify(refreshData).substring(0, 200)
          );

          if (refreshData.success && refreshData.data?.access_token) {
            newAccessToken = refreshData.data.access_token;
            // Ensure refresh token is a string if provided
            const refreshTokenRaw = refreshData.data?.refresh_token;
            newRefreshToken = refreshTokenRaw
              ? typeof refreshTokenRaw === "string"
                ? refreshTokenRaw
                : String(refreshTokenRaw)
              : undefined;
            console.log("✅ Token refreshed successfully in middleware");

            // Set new access token in cookie and allow request to proceed
            const response = NextResponse.next();
            const expires = new Date();
            expires.setMinutes(expires.getMinutes() + 15);
            if (newAccessToken) {
              response.cookies.set("auth_token", newAccessToken, {
                expires: expires,
                path: "/",
                sameSite: "lax",
              });
            }

            // Update refresh token if provided (token rotation)
            if (newRefreshToken) {
              // Ensure refresh token is a string
              const validRefreshToken =
                typeof newRefreshToken === "string"
                  ? newRefreshToken
                  : String(newRefreshToken);

              // Validate it's not "[object Object]"
              if (
                validRefreshToken === "[object Object]" ||
                validRefreshToken.length < 10
              ) {
                console.error(
                  "❌ Invalid refresh token format in middleware:",
                  newRefreshToken
                );
              } else {
                const refreshExpires = new Date();
                refreshExpires.setDate(refreshExpires.getDate() + 30); // 30 days for refresh token
                response.cookies.set("refresh_token", validRefreshToken, {
                  expires: refreshExpires,
                  path: "/",
                  sameSite: "lax",
                });
              }
            }

            return response;
          } else {
            console.log("❌ Invalid refresh response structure:", refreshData);
          }
        } else {
          const errorData = await refreshResponse.json().catch(() => ({}));
          console.log(
            "❌ Refresh failed with status:",
            refreshResponse.status,
            "Error:",
            JSON.stringify(errorData).substring(0, 200)
          );
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

    // If we have neither valid access token nor refresh token, redirect to login
    if (!shouldRefresh && !authToken && !refreshToken) {
      console.log("❌ No valid tokens, redirecting to login");
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const response = NextResponse.redirect(url);
      response.cookies.delete("auth_token");
      response.cookies.delete("refresh_token");
      return response;
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
