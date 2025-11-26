import { stat } from "node:fs/promises";
import { type NextRequest, NextResponse } from "next/server";
import { fileCache } from "@/lib/cache";

/**
 * GET /api/download/[filename]
 * Download a converted image file
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing filename
 * @returns File response or error
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;

    // Validate filename (prevent path traversal)
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // Get file path from cache
    const filePath = fileCache.getFilePath(filename);

    // Check if file exists
    const exists = await fileCache.fileExists(filename);
    if (!exists) {
      return NextResponse.json({ error: "File not found or expired" }, { status: 404 });
    }

    // Check file age
    const age = await fileCache.getFileAge(filename);
    if (age > 15 * 60 * 1000) {
      // File is older than 15 minutes
      return NextResponse.json(
        { error: "File has expired" },
        { status: 410 } // 410 Gone
      );
    }

    // Read file
    const buffer = await require("node:fs/promises").readFile(filePath);

    // Get file stats
    const stats = await stat(filePath);

    // Determine content type from extension
    const ext = filename.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      avif: "image/avif",
      gif: "image/gif",
      tiff: "image/tiff",
      tif: "image/tiff",
      heif: "image/heif",
      heic: "image/heic",
      jxl: "image/jxl",
    };
    const contentType = contentTypes[ext || ""] || "application/octet-stream";

    // Return file with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": stats.size.toString(),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=900", // Cache for 15 minutes
        "X-File-Size": stats.size.toString(),
      },
    });
  } catch (error) {
    console.error("[API] Download error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
