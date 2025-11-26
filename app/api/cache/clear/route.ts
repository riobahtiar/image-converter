import { fileCache } from "@/lib/cache";
import { rm } from "node:fs/promises";
import { NextResponse } from "next/server";

/**
 * POST /api/cache/clear
 * Clears all cached files and resets the cache directory
 */
export async function POST() {
	try {
		const cacheDir = fileCache.getCacheDir();

		// Remove all files in the cache directory
		try {
			await rm(cacheDir, { recursive: true, force: true });
			console.log("[Cache API] Cache directory cleared successfully");
		} catch (error) {
			console.error("[Cache API] Failed to clear cache directory:", error);
		}

		// Reinitialize the cache directory (it will be recreated by the FileCache class)
		// The FileCache.init() method already handles directory creation

		return NextResponse.json({
			success: true,
			message: "Cache cleared successfully",
		});
	} catch (error) {
		console.error("[Cache API] Error clearing cache:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to clear cache",
			},
			{ status: 500 },
		);
	}
}
