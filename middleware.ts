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
      // Validate token by calling /me endpoint
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const tokenToUse = authToken || refreshToken;

      const response = await fetch(`${apiUrl}/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenToUse}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        console.log(
          "✅ Valid token, user is authenticated, redirecting to home"
        );

        // User is authenticated, redirect to home immediately (server-side)
        return NextResponse.redirect(new URL("/", request.url));
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
  if (isProtectedRoute && !authToken && !refreshToken) {
    console.log(
      "🛡️ Protected route detected, no token found, redirecting to login"
    );
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Store the original URL to redirect back after login
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
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
