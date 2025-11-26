/**
 * File Validation Module
 *
 * Provides security-focused file validation using magic number (file signature) detection.
 * Prevents malicious files disguised with fake extensions.
 *
 * @module lib/fileValidation
 *
 * @example
 * // Validate uploaded file
 * import { validateImageFile } from '@/lib/fileValidation';
 *
 * const result = await validateImageFile(file);
 * if (!result.valid) {
 *   return Response.json({ error: result.error }, { status: 400 });
 * }
 */

import { fileTypeFromBuffer } from "file-type";

/**
 * Allowed image MIME types
 * These are the ONLY formats we accept after magic number validation
 *
 * @const {readonly string[]}
 */
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/tiff",
  "image/bmp",
  "image/svg+xml", // SVG (text-based, handled separately)
] as const;

/**
 * Allowed file extensions
 * First-pass check before magic number validation
 *
 * @const {readonly string[]}
 */
const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "tiff",
  "tif",
  "bmp",
  "svg",
] as const;

/**
 * Maximum file size (50MB)
 * Prevents memory exhaustion and DoS attacks
 *
 * @const {number}
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Minimum file size (100 bytes)
 * Prevents empty or corrupted files
 *
 * @const {number}
 */
export const MIN_FILE_SIZE = 100; // 100 bytes

/**
 * File validation result
 *
 * @interface FileValidationResult
 */
export interface FileValidationResult {
  /** Whether the file passed validation */
  valid: boolean;
  /** Detected MIME type from magic number */
  mimeType?: string;
  /** Detected file extension */
  extension?: string;
  /** File size in bytes */
  fileSize?: number;
  /** Error message if validation failed */
  error?: string;
  /** Warning messages (validation passed but with caveats) */
  warnings?: string[];
}

/**
 * Validate image file using magic number detection
 *
 * Security checks performed:
 * 1. File size validation (100 bytes - 50MB)
 * 2. Extension whitelist check
 * 3. Magic number (binary signature) validation
 * 4. MIME type whitelist check
 * 5. Extension/MIME type consistency check
 *
 * This prevents:
 * - Malicious executables disguised as images (.exe → .jpg)
 * - File type spoofing attacks
 * - Memory exhaustion (oversized files)
 * - Empty/corrupted files
 *
 * @param file - File object to validate
 * @returns Validation result with detailed information
 *
 * @example
 * const result = await validateImageFile(uploadedFile);
 *
 * if (!result.valid) {
 *   console.error('Validation failed:', result.error);
 *   return;
 * }
 *
 * if (result.warnings && result.warnings.length > 0) {
 *   console.warn('Validation warnings:', result.warnings);
 * }
 *
 * console.log('File is valid:', result.mimeType);
 */
export async function validateImageFile(file: File): Promise<FileValidationResult> {
  const warnings: string[] = [];

  try {
    // ========================================
    // Step 1: File Size Validation
    // ========================================
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        fileSize: file.size,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB (${(file.size / 1024 / 1024).toFixed(2)}MB provided)`,
      };
    }

    if (file.size < MIN_FILE_SIZE) {
      return {
        valid: false,
        fileSize: file.size,
        error: `File too small. Minimum size is ${MIN_FILE_SIZE} bytes (${file.size} bytes provided). File may be corrupted.`,
      };
    }

    // ========================================
    // Step 2: Extension Validation (Quick Check)
    // ========================================
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension) {
      return {
        valid: false,
        fileSize: file.size,
        error: "File has no extension",
      };
    }

    if (!ALLOWED_EXTENSIONS.includes(extension as any)) {
      return {
        valid: false,
        fileSize: file.size,
        extension,
        error: `Invalid file extension: .${extension}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
      };
    }

    // ========================================
    // Step 3: SVG Special Handling
    // ========================================
    // SVG is text-based (XML), can't be validated via binary magic numbers
    if (extension === "svg") {
      // Read first few bytes to check for XML/SVG markers
      const arrayBuffer = await file.slice(0, 1000).arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);

      if (!text.includes("<svg") && !text.includes("<?xml")) {
        return {
          valid: false,
          fileSize: file.size,
          extension,
          error: "File has .svg extension but doesn't contain valid SVG content",
        };
      }

      // SVG files can contain malicious scripts
      warnings.push(
        "SVG files may contain embedded scripts. Ensure proper sanitization if displaying."
      );

      return {
        valid: true,
        mimeType: "image/svg+xml",
        extension: "svg",
        fileSize: file.size,
        warnings,
      };
    }

    // ========================================
    // Step 4: Magic Number Validation
    // ========================================
    // Read first 4100 bytes for file type detection
    // Most magic numbers are in first few bytes
    const sampleSize = Math.min(4100, file.size);
    const arrayBuffer = await file.slice(0, sampleSize).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Detect actual file type from binary signature
    const detectedType = await fileTypeFromBuffer(buffer);

    if (!detectedType) {
      return {
        valid: false,
        fileSize: file.size,
        extension,
        error:
          "Could not determine file type from content. File may be corrupted or is not a valid image.",
      };
    }

    // ========================================
    // Step 5: MIME Type Whitelist Check
    // ========================================
    if (!ALLOWED_MIME_TYPES.includes(detectedType.mime as any)) {
      return {
        valid: false,
        fileSize: file.size,
        extension,
        mimeType: detectedType.mime,
        error: `Invalid file type: ${detectedType.mime}. This is not a supported image format.`,
      };
    }

    // ========================================
    // Step 6: Extension/MIME Consistency Check
    // ========================================
    // Verify extension matches detected type (prevents spoofing)
    const extensionMimeMap: Record<string, string[]> = {
      jpg: ["image/jpeg"],
      jpeg: ["image/jpeg"],
      png: ["image/png"],
      webp: ["image/webp"],
      gif: ["image/gif"],
      avif: ["image/avif"],
      tiff: ["image/tiff"],
      tif: ["image/tiff"],
      bmp: ["image/bmp", "image/x-ms-bmp"],
    };

    const expectedMimes = extensionMimeMap[extension];
    if (expectedMimes && !expectedMimes.includes(detectedType.mime)) {
      warnings.push(
        `Extension mismatch: file has .${extension} extension but content is ${detectedType.mime}. This may indicate file spoofing.`
      );
    }

    // ========================================
    // Success!
    // ========================================
    return {
      valid: true,
      mimeType: detectedType.mime,
      extension: detectedType.ext,
      fileSize: file.size,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error("File validation error:", error);
    return {
      valid: false,
      fileSize: file.size,
      error:
        error instanceof Error
          ? `Validation failed: ${error.message}`
          : "File validation failed due to an unknown error",
    };
  }
}

/**
 * Validate file from Buffer
 *
 * Useful for validating files already loaded into memory
 *
 * @param buffer - File buffer
 * @param filename - Original filename (for extension checking)
 * @param fileSize - File size in bytes
 * @returns Validation result
 *
 * @example
 * const buffer = await file.arrayBuffer();
 * const result = await validateImageBuffer(
 *   Buffer.from(buffer),
 *   'photo.jpg',
 *   buffer.byteLength
 * );
 */
export async function validateImageBuffer(
  buffer: Buffer,
  filename: string,
  fileSize: number
): Promise<FileValidationResult> {
  const warnings: string[] = [];

  try {
    // Size validation
    if (fileSize > MAX_FILE_SIZE) {
      return {
        valid: false,
        fileSize,
        error: `Buffer too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    if (fileSize < MIN_FILE_SIZE) {
      return {
        valid: false,
        fileSize,
        error: `Buffer too small. Minimum size is ${MIN_FILE_SIZE} bytes`,
      };
    }

    // Extension validation
    const extension = filename.split(".").pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension as any)) {
      return {
        valid: false,
        fileSize,
        error: `Invalid file extension: ${extension}`,
      };
    }

    // SVG handling
    if (extension === "svg") {
      const text = buffer.toString("utf-8", 0, Math.min(1000, buffer.length));
      if (!text.includes("<svg") && !text.includes("<?xml")) {
        return {
          valid: false,
          fileSize,
          error: "Invalid SVG content",
        };
      }

      warnings.push("SVG files may contain embedded scripts");

      return {
        valid: true,
        mimeType: "image/svg+xml",
        extension: "svg",
        fileSize,
        warnings,
      };
    }

    // Magic number detection
    const detectedType = await fileTypeFromBuffer(buffer);

    if (!detectedType) {
      return {
        valid: false,
        fileSize,
        error: "Could not determine file type from buffer",
      };
    }

    if (!ALLOWED_MIME_TYPES.includes(detectedType.mime as any)) {
      return {
        valid: false,
        fileSize,
        mimeType: detectedType.mime,
        error: `Invalid MIME type: ${detectedType.mime}`,
      };
    }

    return {
      valid: true,
      mimeType: detectedType.mime,
      extension: detectedType.ext,
      fileSize,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      valid: false,
      fileSize,
      error: error instanceof Error ? error.message : "Buffer validation failed",
    };
  }
}

/**
 * Quick extension-only validation
 *
 * Faster but less secure - only checks extension without magic numbers.
 * Use for client-side pre-validation.
 *
 * @param filename - Filename to check
 * @returns True if extension is allowed
 *
 * @example
 * if (!isAllowedExtension('photo.jpg')) {
 *   alert('Invalid file type');
 *   return;
 * }
 */
export function isAllowedExtension(filename: string): boolean {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ? ALLOWED_EXTENSIONS.includes(extension as any) : false;
}

/**
 * Format file size for human-readable display
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 *
 * @example
 * formatFileSize(1572864); // "1.50 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  if (bytes < 1024) return `${bytes} Bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Get human-readable error message for validation failure
 *
 * @param result - Validation result
 * @returns User-friendly error message
 *
 * @example
 * const result = await validateImageFile(file);
 * if (!result.valid) {
 *   alert(getValidationErrorMessage(result));
 * }
 */
export function getValidationErrorMessage(result: FileValidationResult): string {
  if (result.valid) return "";
  return result.error || "File validation failed";
}

/**
 * Batch validate multiple files
 *
 * @param files - Array of files to validate
 * @returns Array of validation results
 *
 * @example
 * const files = Array.from(input.files);
 * const results = await validateImageFiles(files);
 *
 * const invalid = results.filter(r => !r.valid);
 * if (invalid.length > 0) {
 *   console.error('Invalid files:', invalid);
 * }
 */
export async function validateImageFiles(files: File[]): Promise<FileValidationResult[]> {
  return Promise.all(files.map((file) => validateImageFile(file)));
}
