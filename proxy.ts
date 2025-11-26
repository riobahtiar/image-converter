/**
 * Next.js Proxy (Next.js 16+)
 *
 * Runs before every request to handle:
 * - Session initialization
 * - Rate limiting
 * - Security headers
 * - Request logging
 *
 * Note: In Next.js 16+, this file is named "proxy.ts" instead of "middleware.ts"
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */

import { type NextRequest, NextResponse } from "next/server";
import { checkRateLimit, ipRateLimiter } from "./lib/ratelimit";

/**
 * Proxy function (Next.js 16+ requirement)
 * Executes on every request matching the config.matcher
 *
 * @param request - Incoming request
 * @returns Response with applied security measures
 */
export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// ========================================
	// Rate Limiting for API Routes
	// ========================================
	if (pathname.startsWith("/api/")) {
		// Get client identifier (IP address)
		const ip = request.headers.get("x-forwarded-for") ||
		           request.headers.get("x-real-ip") ||
		           "unknown";

		// Skip rate limiting for health checks
		if (pathname === "/api/health") {
			return NextResponse.next();
		}

		// Apply rate limiting
		try {
			const result = await checkRateLimit(ip, "api", ipRateLimiter);

			// If rate limited, return 429
			if (!result.success) {
				return NextResponse.json(
					{
						error: "Rate limit exceeded",
						message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
						limit: result.limit,
						remaining: 0,
						reset: result.reset,
					},
					{
						status: 429,
						headers: {
							...result.headers,
							"Content-Type": "application/json",
						},
					},
				);
			}

			// Add rate limit headers to response
			const response = NextResponse.next();

			// Add rate limit headers
			for (const [key, value] of Object.entries(result.headers)) {
				response.headers.set(key, value);
			}

			// Add security headers
			addSecurityHeaders(response);

			return response;
		} catch (error) {
			console.error("Rate limit middleware error:", error);
			// Fail open - allow request on error
			const response = NextResponse.next();
			addSecurityHeaders(response);
			return response;
		}
	}

	// ========================================
	// Security Headers for All Routes
	// ========================================
	const response = NextResponse.next();
	addSecurityHeaders(response);
	return response;
}

/**
 * Add security headers to response
 *
 * Headers added:
 * - X-Content-Type-Options: nosniff (prevent MIME sniffing)
 * - X-Frame-Options: DENY (prevent clickjacking)
 * - X-XSS-Protection: 1; mode=block (XSS protection for older browsers)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: restrictive permissions
 *
 * @param response - Response to add headers to
 */
function addSecurityHeaders(response: NextResponse): void {
	// Prevent MIME type sniffing
	response.headers.set("X-Content-Type-Options", "nosniff");

	// Prevent clickjacking
	response.headers.set("X-Frame-Options", "DENY");

	// XSS protection (legacy, but still useful for older browsers)
	response.headers.set("X-XSS-Protection", "1; mode=block");

	// Referrer policy
	response.headers.set(
		"Referrer-Policy",
		"strict-origin-when-cross-origin",
	);

	// Permissions policy - disable unnecessary features
	response.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), interest-cohort=()",
	);

	// Note: CSP (Content-Security-Policy) is typically set in next.config.ts
	// to avoid conflicts with Next.js's built-in CSP handling
}

/**
 * Proxy configuration
 * Specifies which routes the proxy middleware should run on
 *
 * Patterns:
 * - /api/:path* - All API routes (for rate limiting)
 * - /((?!_next/static|_next/image|favicon.ico).*) - All other routes except Next.js internals
 */
export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		"/((?!_next/static|_next/image|favicon.ico).*)",
	],
};
