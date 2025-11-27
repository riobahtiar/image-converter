import { join } from "node:path";
import archiver from "archiver";
import { type NextRequest, NextResponse } from "next/server";
import { fileCache } from "@/lib/cache";
import { getSession } from "@/lib/session";

/**
 * POST /api/download-all
 * Create a ZIP file of multiple converted images
 *
 * Security features:
 * - Session validation (users can only download their own files)
 * - Path traversal prevention
 * - File existence validation
 *
 * Accepts JSON body with:
 * - filenames: Array of filenames to include in the ZIP
 *
 * Returns ZIP file download
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================
    // Step 1: Get Current User Session
    // ========================================
    const session = await getSession();

    // ========================================
    // Step 2: Parse and Validate Request Body
    // ========================================
    const body = await request.json();
    const { filenames } = body as { filenames: string[] };

    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return NextResponse.json({ error: "No filenames provided" }, { status: 400 });
    }

    // Limit number of files in a single ZIP (prevent memory issues)
    if (filenames.length > 100) {
      return NextResponse.json(
        { error: "Too many files. Maximum 100 files per ZIP." },
        { status: 400 }
      );
    }

    // ========================================
    // Step 3: Validate Files (Security + Existence) and Load Metadata
    // ========================================
    const validFiles: Array<{ storedFilename: string; downloadFilename: string }> = [];
    const sessionDir = fileCache.getSessionDir(session.sessionId);

    // Load metadata mapping
    const metadataPath = join(sessionDir, ".metadata.json");
    let metadata: Record<string, string> = {};
    try {
      const metadataContent = await require("node:fs/promises").readFile(metadataPath, "utf-8");
      metadata = JSON.parse(metadataContent);
    } catch {
      // Metadata file doesn't exist, that's fine - we'll use stored filenames
    }

    for (const filename of filenames) {
      // Path traversal prevention
      if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\") ||
        filename.startsWith(".")
      ) {
        console.warn(`[Download-All] Path traversal attempt: ${filename}`);
        continue; // Skip invalid filenames
      }

      // Check file exists in user's session directory
      if (await fileCache.fileExists(filename, session.sessionId)) {
        // Get the download filename from metadata, or use stored filename as fallback
        const downloadFilename = metadata[filename] || filename;
        validFiles.push({ storedFilename: filename, downloadFilename });
      }
    }

    if (validFiles.length === 0) {
      return NextResponse.json(
        {
          error: "No valid files found",
          message: "None of the requested files exist in your session or they have expired.",
        },
        { status: 404 }
      );
    }

    // Create a PassThrough stream for the ZIP output
    const { PassThrough } = await import("node:stream");
    const stream = new PassThrough();

    // Create archiver instance
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    });

    // Pipe archive data to the stream
    archive.pipe(stream);

    // ========================================
    // Step 4: Add Files to ZIP Archive with Original Filenames
    // ========================================
    // Add files from user's session directory, using original filenames in ZIP
    for (const { storedFilename, downloadFilename } of validFiles) {
      const filePath = join(sessionDir, storedFilename);
      // Use downloadFilename (original name + new extension) as the name in the ZIP
      archive.file(filePath, { name: downloadFilename });
    }

    // Finalize the archive (this is important!)
    archive.finalize();

    // Generate a unique filename for the ZIP
    // Format: image-co-[hash 4 digit+epoch time].zip
    // Since we don't have a complex hash function handy and want to keep it simple/fast:
    // We'll use a random 4-char string + timestamp
    const randomHash = Math.random().toString(36).substring(2, 6);
    const timestamp = Date.now();
    const zipFilename = `image-co-${randomHash}${timestamp}.zip`;

    // Return the stream as response
    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
      },
    });
  } catch (error) {
    console.error("[API] Bulk download error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
