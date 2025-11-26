/**
 * Image conversion types and interfaces
 * Shared between CLI and Web applications
 */

/**
 * Supported output image formats
 */
export type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "tiff" | "gif" | "heif" | "jxl";

/**
 * Resize fit modes
 * - cover: Crop to cover both provided dimensions
 * - contain: Preserve aspect ratio, resize to be contained within dimensions
 * - fill: Ignore aspect ratio, stretch to fill dimensions
 * - inside: Preserve aspect ratio, resize to fit within dimensions
 * - outside: Preserve aspect ratio, resize to fit outside dimensions
 */
export type ResizeFit = "cover" | "contain" | "fill" | "inside" | "outside";

/**
 * Image conversion options
 * @interface ConversionOptions
 */
export interface ConversionOptions {
  /** Target width in pixels (undefined = auto) */
  width?: number;
  /** Target height in pixels (undefined = auto) */
  height?: number;
  /** Output image format */
  format: ImageFormat;
  /** Image quality (1-100) */
  quality: number;
  /** Resize fit mode */
  fit: ResizeFit;
  /** Preserve aspect ratio */
  preserveAspectRatio?: boolean;
}

/**
 * Image conversion result
 * @interface ConversionResult
 */
export interface ConversionResult {
  /** Success status */
  success: boolean;
  /** Output file path (if successful) */
  outputPath?: string;
  /** Original file size in bytes */
  originalSize?: number;
  /** Converted file size in bytes */
  convertedSize?: number;
  /** File size reduction percentage */
  reductionPercent?: number;
  /** Error message (if failed) */
  error?: string;
  /** Original filename */
  originalFilename?: string;
  /** Output filename */
  outputFilename?: string;
}

/**
 * Batch conversion statistics
 * @interface BatchStats
 */
export interface BatchStats {
  /** Total files processed */
  total: number;
  /** Successfully converted */
  success: number;
  /** Failed conversions */
  failed: number;
  /** Skipped files */
  skipped: number;
  /** Total original size in bytes */
  totalOriginalSize: number;
  /** Total converted size in bytes */
  totalConvertedSize: number;
  /** Overall size reduction percentage */
  overallReduction: number;
}
