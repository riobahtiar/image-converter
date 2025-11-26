import { writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { fileCache } from "@/lib/cache";
import { convertImage } from "@/lib/converter";
import type { ImageFormat, ResizeFit } from "@/lib/converter/types";
import { generateUniqueFilename } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { checkRateLimit, conversionRateLimiter } from "@/lib/ratelimit";
import { validateImageFile, MAX_FILE_SIZE } from "@/lib/fileValidation";

/**
 * Supported input image formats
 */
const SUPPORTED_FORMATS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".tiff",
  ".tif",
  ".avif",
  ".heif",
  ".heic",
  ".jxl",
  ".bmp",
];

/**
 * POST /api/convert
 * Upload and convert images
 *
 * Accepts multipart/form-data with:
 * - files: One or more image files
 * - format: Output format (jpeg|png|webp|avif|tiff|gif|heif|jxl)
 * - quality: Image quality (1-100)
 * - width: Target width (optional)
 * - height: Target height (optional)
 * - fit: Resize fit mode (cover|contain|fill|inside|outside)
 *
 * Returns JSON with conversion results and download URLs
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================
    // Step 1: Session Management
    // ========================================
    const session = await getSession();

    // ========================================
    // Step 2: Rate Limiting (Conversion-Specific)
    // ========================================
    const rateLimitResult = await checkRateLimit(
      session.sessionId,
      "convert",
      conversionRateLimiter
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many conversions. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          limit: rateLimitResult.limit,
          remaining: 0,
        },
        {
          status: 429,
          headers: rateLimitResult.headers,
        }
      );
    }

    // ========================================
    // Step 3: Parse Form Data
    // ========================================
    const formData = await request.formData();

    // Get uploaded files
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // Validate file count (max 50 files per request)
    if (files.length > 50) {
      return NextResponse.json(
        { error: "Too many files. Maximum 50 files per request." },
        { status: 400 }
      );
    }

    // Extract bulk conversion options (used if no per-file settings)
    const bulkFormat = (formData.get("format") as ImageFormat) || "webp";
    const bulkQuality = parseInt(formData.get("quality") as string, 10) || 80;
    const bulkWidth = formData.get("width")
      ? parseInt(formData.get("width") as string, 10)
      : undefined;
    const bulkHeight = formData.get("height")
      ? parseInt(formData.get("height") as string, 10)
      : undefined;
    const bulkFit = (formData.get("fit") as ResizeFit) || "inside";

    // Check for per-file settings
    const perFileSettings: Array<{
      format: ImageFormat;
      quality: number;
      width?: number;
      height?: number;
      fit: ResizeFit;
    } | null> = [];

    for (let i = 0; i < files.length; i++) {
      const settingsJson = formData.get(`settings[${i}]`);
      if (settingsJson) {
        try {
          perFileSettings[i] = JSON.parse(settingsJson as string);
        } catch {
          perFileSettings[i] = null;
        }
      } else {
        perFileSettings[i] = null;
      }
    }

    // ========================================
    // Step 4: Ensure Session Directory Exists
    // ========================================
    const sessionDir = await fileCache.ensureSessionDir(session.sessionId);

    // ========================================
    // Step 5: Validate All Files Before Processing
    // ========================================
    for (const file of files) {
      // File size check
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          },
          { status: 413 }
        );
      }

      // Magic number validation
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: `File "${file.name}" validation failed: ${validation.error}`,
          },
          { status: 400 }
        );
      }

      // Log warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn(`File "${file.name}" warnings:`, validation.warnings);
      }
    }

    // ========================================
    // Step 6: Process Each File
    // ========================================
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      try {
        // Get settings for this file (per-file or bulk)
        const fileSettings = perFileSettings[i] || {
          format: bulkFormat,
          quality: bulkQuality,
          width: bulkWidth,
          height: bulkHeight,
          fit: bulkFit,
        };

        // Generate unique filename for session directory
        const uniqueFilename = generateUniqueFilename(file.name);
        const inputPath = join(sessionDir, uniqueFilename);

        // Save uploaded file to session directory
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(inputPath, buffer);

        // Generate output filename: preserve original name, only change extension
        const fileBaseName = basename(file.name, extname(file.name));
        const downloadFilename = `${fileBaseName}.${fileSettings.format}`;

        // Generate unique filename for storage (security/isolation)
        const uniqueStoredFilename = generateUniqueFilename(downloadFilename);
        const outputPath = join(sessionDir, uniqueStoredFilename);

        // Convert image with file-specific settings
        const result = await convertImage(buffer, outputPath, {
          format: fileSettings.format,
          quality: fileSettings.quality,
          width: fileSettings.width,
          height: fileSettings.height,
          fit: fileSettings.fit,
          preserveAspectRatio: true,
        });

        if (result.success) {
          const outputBasename = basename(outputPath);

          // Store metadata mapping: unique stored filename -> download filename
          const metadataPath = join(sessionDir, ".metadata.json");
          let metadata: Record<string, string> = {};
          try {
            const existingMetadata = await require("node:fs/promises").readFile(
              metadataPath,
              "utf-8"
            );
            metadata = JSON.parse(existingMetadata);
          } catch {
            // Metadata file doesn't exist yet, that's fine
          }
          metadata[outputBasename] = downloadFilename;
          await require("node:fs/promises").writeFile(
            metadataPath,
            JSON.stringify(metadata, null, 2)
          );

          results.push({
            success: true,
            originalFilename: file.name,
            outputFilename: outputBasename, // Internal unique filename
            downloadFilename: downloadFilename, // User-facing filename (original name + new extension)
            // Download URL includes session ID for validation
            downloadUrl: `/api/download/${session.sessionId}/${outputBasename}`,
            originalSize: result.originalSize,
            convertedSize: result.convertedSize,
            reductionPercent: result.reductionPercent,
          });
        } else {
          results.push({
            success: false,
            originalFilename: file.name,
            error: result.error,
          });
        }

        // Clean up input file
        await require("node:fs/promises").unlink(inputPath);
      } catch (error) {
        results.push({
          success: false,
          originalFilename: file.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Calculate statistics
    const stats = {
      total: results.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      totalOriginalSize: results.reduce((sum, r) => sum + (r.originalSize || 0), 0),
      totalConvertedSize: results.reduce((sum, r) => sum + (r.convertedSize || 0), 0),
    };

    // ========================================
    // Step 7: Return Results with Rate Limit Headers
    // ========================================
    return NextResponse.json(
      {
        success: true,
        results,
        stats,
        sessionId: session.sessionId, // Include session ID for debugging
      },
      {
        headers: rateLimitResult.headers,
      }
    );
  } catch (error) {
    console.error("[API] Convert error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/convert
 * Get conversion options and supported formats
 */
export async function GET() {
  return NextResponse.json({
    supportedInputFormats: SUPPORTED_FORMATS,
    supportedOutputFormats: ["jpeg", "png", "webp", "avif", "tiff", "gif", "heif", "jxl"],
    defaultOptions: {
      format: "webp",
      quality: 80,
      fit: "inside",
    },
    limits: {
      maxFileSize: "50MB",
      maxFiles: 50,
    },
  });
}
