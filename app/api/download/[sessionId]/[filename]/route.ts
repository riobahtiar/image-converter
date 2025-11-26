/**
 * Download API with Session Validation
 *
 * GET /api/download/[sessionId]/[filename]
 *
 * Security features:
 * - Session ownership validation
 * - Path traversal prevention
 * - File expiration checking
 * - Rate limiting (via middleware)
 *
 * @module app/api/download/[sessionId]/[filename]/route
 */

import { stat } from "node:fs/promises";
import { type NextRequest, NextResponse } from "next/server";
import { fileCache } from "@/lib/cache";
import { getSession } from "@/lib/session";

/**
 * GET /api/download/[sessionId]/[filename]
 * Download a converted image file
 *
 * Security checks:
 * 1. Validate session ownership (user can only download their own files)
 * 2. Prevent path traversal attacks
 * 3. Check file expiration
 * 4. Verify file exists
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing sessionId and filename
 * @returns File response or error
 *
 * @example
 * GET /api/download/abc123def456/converted-image.webp
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; filename: string }> }
) {
  try {
    const { sessionId, filename } = await params;

    // ========================================
    // Step 1: Get Current User Session
    // ========================================
    const currentSession = await getSession();

    // ========================================
    // Step 2: Validate Session Ownership
    // ========================================
    // User can only download files from their own session
    if (currentSession.sessionId !== sessionId) {
      console.warn(
        `[Download] Session mismatch: ${currentSession.sessionId} attempted to access ${sessionId}`
      );
      return NextResponse.json(
        {
          error: "Forbidden",
          message:
            "You can only download files from your own session. This file belongs to a different user.",
        },
        { status: 403 }
      );
    }

    // ========================================
    // Step 3: Validate Filename (Path Traversal Prevention)
    // ========================================
    // Prevent directory traversal attacks (../, ..\, absolute paths)
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.startsWith(".")
    ) {
      console.warn(`[Download] Path traversal attempt: ${filename} by session ${sessionId}`);
      return NextResponse.json(
        {
          error: "Invalid filename",
          message: "Filename contains invalid characters. Path traversal attacks are blocked.",
        },
        { status: 400 }
      );
    }

    // ========================================
    // Step 4: Check File Exists in Session Directory
    // ========================================
    const fileExists = await fileCache.fileExists(filename, sessionId);

    if (!fileExists) {
      return NextResponse.json(
        {
          error: "File not found",
          message:
            "The requested file does not exist or has expired. Files are automatically deleted after 15 minutes.",
        },
        { status: 404 }
      );
    }

    // ========================================
    // Step 5: Check File Expiration
    // ========================================
    const fileAge = await fileCache.getFileAge(filename, sessionId);
    const maxAge = Number.parseInt(process.env.CACHE_MAX_AGE_MINUTES || "15", 10) * 60 * 1000;

    if (fileAge > maxAge) {
      // File is older than max age - should have been cleaned up
      console.warn(`[Download] Expired file accessed: ${filename} (age: ${fileAge}ms)`);
      return NextResponse.json(
        {
          error: "File expired",
          message: `This file has expired. Files are kept for ${maxAge / 60 / 1000} minutes.`,
        },
        { status: 410 } // 410 Gone
      );
    }

    // ========================================
    // Step 6: Read Metadata for Original Filename
    // ========================================
    const sessionDir = fileCache.getSessionDir(sessionId);
    const metadataPath = `${sessionDir}/.metadata.json`;
    let downloadFilename = filename; // Default to stored filename if metadata not found

    try {
      const metadataContent = await require("node:fs/promises").readFile(metadataPath, "utf-8");
      const metadata: Record<string, string> = JSON.parse(metadataContent);
      if (metadata[filename]) {
        downloadFilename = metadata[filename];
      }
    } catch {
      // Metadata file doesn't exist or is invalid, use stored filename
    }

    // ========================================
    // Step 7: Read and Serve File
    // ========================================
    const filePath = `${sessionDir}/${filename}`;

    // Read file
    const buffer = await require("node:fs/promises").readFile(filePath);

    // Get file stats
    const stats = await stat(filePath);

    // Determine content type from extension (use download filename for proper MIME type)
    const ext = downloadFilename.split(".").pop()?.toLowerCase();
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
      bmp: "image/bmp",
    };
    const contentType = contentTypes[ext || ""] || "application/octet-stream";

    // Escape filename for Content-Disposition header (RFC 5987)
    const escapedFilename = downloadFilename.replace(/[^\x20-\x7E]/g, (char) => {
      return encodeURIComponent(char);
    });

    // ========================================
    // Step 8: Return File with Headers
    // ========================================
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": stats.size.toString(),
        "Content-Disposition": `attachment; filename="${escapedFilename}"; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
        "Cache-Control": `private, max-age=${maxAge / 1000}`, // Private cache only
        "X-File-Size": stats.size.toString(),
        "X-Session-Id": sessionId, // For debugging
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
