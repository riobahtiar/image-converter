/**
 * Cache Clear API with Session Isolation
 *
 * POST /api/cache/clear
 *
 * Security:
 * - Only clears the current user's session files
 * - Does NOT affect other users' files
 * - Session-isolated cache management
 *
 * @module app/api/cache/clear/route
 */

import { fileCache } from "@/lib/cache";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * POST /api/cache/clear
 * Clears cached files for the current user's session only
 *
 * Security features:
 * - Session-based isolation (only clears current user's files)
 * - Does not affect other users
 * - Safe for multi-user environments
 *
 * @returns Success/error response
 */
export async function POST() {
	try {
		// ========================================
		// Step 1: Get Current User Session
		// ========================================
		const session = await getSession();

		// ========================================
		// Step 2: Clear Only User's Session Directory
		// ========================================
		try {
			await fileCache.clearSession(session.sessionId);
			console.log(
				`[Cache API] Cleared session ${session.sessionId} successfully`,
			);

			return NextResponse.json({
				success: true,
				message: "Your files have been cleared successfully",
				sessionId: session.sessionId,
			});
		} catch (error) {
			console.error(
				`[Cache API] Failed to clear session ${session.sessionId}:`,
				error,
			);
			return NextResponse.json(
				{
					success: false,
					error: "Failed to clear your files",
					message:
						error instanceof Error ? error.message : "Unknown error occurred",
				},
				{ status: 500 },
			);
		}
	} catch (error) {
		console.error("[Cache API] Error in clear endpoint:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
