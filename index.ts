import { mkdir, readdir, stat, rm, rmdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join } from "node:path";
import sharp from "sharp";
import { defaultConfig, getCompressionSettings } from "./config";

/**
 * Transformation configuration interface for image processing
 * @interface TransformConfig
 */
interface TransformConfig {
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Output image format */
  format?: "jpeg" | "png" | "webp" | "avif" | "tiff" | "gif" | "heif" | "jxl";
  /** Image quality from 1-100 */
  quality?: number;
  /** Resize fit mode */
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  /** Whether to preserve aspect ratio */
  preserveAspectRatio?: boolean;
}

/**
 * Circuit Breaker implementation for fault tolerance
 * Prevents cascading failures by stopping processing when error threshold is reached
 * @class CircuitBreaker
 */
class CircuitBreaker {
  private failureCount: number = 0;
  private successCount: number = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private lastFailureTime: number = 0;

  /**
   * Creates a circuit breaker instance
   * @param {number} failureThreshold - Number of failures before opening circuit
   * @param {number} resetTimeout - Time in ms before attempting to close circuit
   */
  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 30000
  ) { }

  /**
   * Check if circuit breaker allows request
   * @returns {boolean} Whether the request should be allowed
   */
  canProceed(): boolean {
    if (this.state === "CLOSED") {
      return true;
    }

    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.resetTimeout) {
        this.state = "HALF_OPEN";
        console.log("⚡ Circuit breaker entering HALF_OPEN state, attempting recovery...");
        return true;
      }
      return false;
    }

    // HALF_OPEN state
    return true;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.successCount++;
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.failureCount = 0;
      console.log("✅ Circuit breaker CLOSED - system recovered");
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      console.error(`
⚠️  CIRCUIT BREAKER OPENED!
   Failure threshold reached (${this.failureCount}/${this.failureThreshold})
   Processing stopped to prevent system overload
   Will retry after ${this.resetTimeout / 1000}s
      `);
    }
  }

  /**
   * Get current circuit breaker state
   * @returns {Object} Current state information
   */
  getState() {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      threshold: this.failureThreshold,
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.state = "CLOSED";
    this.lastFailureTime = 0;
  }
}

/**
 * Logger class for writing error logs to files with timestamps and detailed information
 * Provides structured logging with automatic file rotation and log management
 * @class Logger
 */
class Logger {
  private logDir: string = "./logs";
  private errorLogFile: string = join(this.logDir, "error.log");
  private infoLogFile: string = join(this.logDir, "info.log");

  /**
   * Creates a logger instance and ensures log directory exists
   */
  constructor() {
    // Synchronously ensure log directory exists
    try {
      const fs = require("node:fs");
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error("Failed to create log directory:", error);
    }
  }

  /**
   * Formats current timestamp in ISO format
   * @private
   * @returns {string} Formatted timestamp
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Writes a log entry to the specified file
   * @private
   * @param {string} logFile - Path to log file
   * @param {string} level - Log level (ERROR, INFO, WARNING)
   * @param {string} message - Log message
   * @param {any} data - Additional data to log
   * @returns {Promise<void>}
   */
  private async writeLog(
    logFile: string,
    level: string,
    message: string,
    data?: any
  ): Promise<void> {
    try {
      const timestamp = this.getTimestamp();
      const logEntry = {
        timestamp,
        level,
        message,
        ...(data && { data }),
      };

      const logLine = `${JSON.stringify(logEntry, null, 2)}\n${"-".repeat(80)}\n`;

      // Use fs.appendFileSync for reliability
      const fs = require("node:fs");
      fs.appendFileSync(logFile, logLine, "utf8");
    } catch (error) {
      console.error("Failed to write log:", error);
    }
  }

  /**
   * Logs an error with detailed information
   * @param {string} message - Error message
   * @param {Error | unknown} error - Error object
   * @param {Object} context - Additional context information
   * @returns {Promise<void>}
   * @example
   * logger.error("Failed to process image", error, { file: "image.jpg", format: "webp" });
   */
  async error(message: string, error: Error | unknown, context?: any): Promise<void> {
    const errorData = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
    };

    await this.writeLog(this.errorLogFile, "ERROR", message, errorData);
  }

  /**
   * Logs informational message
   * @param {string} message - Info message
   * @param {any} data - Optional data to include
   * @returns {Promise<void>}
   * @example
   * logger.info("Processing started", { totalFiles: 10 });
   */
  async info(message: string, data?: any): Promise<void> {
    await this.writeLog(this.infoLogFile, "INFO", message, data);
  }

  /**
   * Logs a warning message
   * @param {string} message - Warning message
   * @param {any} data - Optional data to include
   * @returns {Promise<void>}
   * @example
   * logger.warning("Image quality too low", { file: "test.jpg", quality: 10 });
   */
  async warning(message: string, data?: any): Promise<void> {
    await this.writeLog(this.errorLogFile, "WARNING", message, data);
  }

  /**
   * Clears all log files
   * @returns {Promise<number>} Number of log files cleared
   * @example
   * const clearedCount = await logger.clearLogs();
   */
  async clearLogs(): Promise<number> {
    try {
      const files = await readdir(this.logDir);
      let count = 0;

      for (const file of files) {
        if (file === ".gitkeep") continue;
        if (file.endsWith(".log")) {
          const filePath = join(this.logDir, file);
          await rm(filePath, { force: true });
          count++;
        }
      }

      return count;
    } catch (error) {
      console.error("Failed to clear logs:", error);
      return 0;
    }
  }

  /**
   * Gets log file statistics
   * @returns {Promise<Object>} Log statistics including file sizes
   * @example
   * const stats = await logger.getStats();
   * console.log(`Error log size: ${stats.errorLogSize} bytes`);
   */
  async getStats(): Promise<{ errorLogSize: number; infoLogSize: number }> {
    try {
      const errorLogSize = existsSync(this.errorLogFile)
        ? (await stat(this.errorLogFile)).size
        : 0;
      const infoLogSize = existsSync(this.infoLogFile)
        ? (await stat(this.infoLogFile)).size
        : 0;

      return { errorLogSize, infoLogSize };
    } catch (_error) {
      return { errorLogSize: 0, infoLogSize: 0 };
    }
  }
}

const DEFAULT_CONFIG: TransformConfig = {
  width: undefined, // undefined = auto (keeps original or calculates from aspect ratio)
  height: undefined, // undefined = auto (keeps original or calculates from aspect ratio)
  format: defaultConfig.format,
  quality: defaultConfig.quality,
  fit: defaultConfig.fit,
  preserveAspectRatio: defaultConfig.preserveAspectRatio,
};

// Supported image formats (input formats that Sharp can read)
const SUPPORTED_FORMATS = [
  ".jpg",
  ".jpeg", // JPEG
  ".png", // PNG
  ".webp", // WebP
  ".gif", // GIF (including animated)
  ".svg", // SVG
  ".tiff",
  ".tif", // TIFF
  ".avif", // AVIF
  ".heif",
  ".heic", // HEIF (Apple)
  ".jxl", // JPEG XL (next-gen)
  ".bmp", // BMP
];

/**
 * Converts filename to URL-safe format
 * @param {string} text - The filename to slugify
 * @returns {string} URL-safe filename
 * @example
 * slugify("My Photo 2024!.jpg") // Returns "my-photo-2024"
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "-") // Replace non-word chars with -
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start
    .replace(/-+$/, ""); // Trim - from end
}

/**
 * Removes all files from a directory recursively while preserving directory structure
 * Preserves .gitkeep files
 * @param {string} dir - Directory path to clean
 * @returns {Promise<number>} Number of files removed
 * @throws {Error} If directory cannot be accessed
 */
async function cleanDirectory(dir: string): Promise<number> {
  try {
    const _fs = require("node:fs");
    const entries = await readdir(dir, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      // Skip .gitkeep files
      if (entry.name === ".gitkeep") continue;

      const entryPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively clean subdirectories
        count += await cleanDirectory(entryPath);
        // Remove empty directory
        try {
          await rmdir(entryPath);
        } catch (_e) {
          // Directory might not be empty, that's okay
        }
      } else if (entry.isFile()) {
        await rm(entryPath, { force: true });
        count++;
      }
    }

    return count;
  } catch (error) {
    console.error(`Failed to clean directory ${dir}:`, error);
    return 0;
  }
}

/**
 * Ensures a directory exists, creating it if necessary
 * @param {string} dir - Directory path to ensure exists
 * @param {boolean} silent - If true, don't log success message
 * @returns {Promise<void>}
 * @throws {Error} If directory cannot be created
 */
async function ensureDirectory(dir: string, silent: boolean = false): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
    if (!silent) {
      console.log(`✓ Directory ready: ${dir}`);
    }
  } catch (error) {
    console.error(`Failed to create directory ${dir}:`, error);
    throw error;
  }
}

/**
 * Retrieves all supported image files from a directory recursively
 * @param {string} sourceDir - Source directory to scan
 * @param {string} relativePath - Current relative path for recursion (internal use)
 * @returns {Promise<string[]>} Array of image file paths relative to sourceDir
 * @throws {Error} If directory cannot be read
 * @example
 * const files = await getImageFiles("./raw");
 * // Returns: ["photo.jpg", "subfolder/image.png", "subfolder/nested/pic.webp"]
 */
async function getImageFiles(sourceDir: string, relativePath: string = ""): Promise<string[]> {
  try {
    const _fs = require("node:fs");
    const _path = require("node:path");
    const currentPath = relativePath ? join(sourceDir, relativePath) : sourceDir;
    const entries = await readdir(currentPath, { withFileTypes: true });

    const imageFiles: string[] = [];

    for (const entry of entries) {
      const entryRelativePath = relativePath ? join(relativePath, entry.name) : entry.name;
      const _entryFullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subDirFiles = await getImageFiles(sourceDir, entryRelativePath);
        imageFiles.push(...subDirFiles);
      } else if (entry.isFile()) {
        // Check if file is a supported image format
        if (SUPPORTED_FORMATS.includes(extname(entry.name).toLowerCase())) {
          imageFiles.push(entryRelativePath);
        }
      }
    }

    return imageFiles;
  } catch (error) {
    console.error(`Failed to read directory ${sourceDir}:`, error);
    throw error;
  }
}

/**
 * Transforms a single image with advanced processing options
 * Applies transformations, compression, format conversion, and metadata handling
 * @param {string} inputPath - Path to source image file
 * @param {string} outputPath - Path for transformed output file
 * @param {TransformConfig} config - Transformation configuration
 * @returns {Promise<boolean>} True if transformation succeeded, false otherwise
 * @example
 * const success = await transformImage("./input.jpg", "./output.webp", { format: "webp", quality: 80 });
 */
async function transformImage(
  inputPath: string,
  outputPath: string,
  config: TransformConfig,
  logger?: Logger
): Promise<boolean> {
  try {
    let transformer = sharp(inputPath);

    // Apply image transformations (from defaultConfig)
    const transforms = defaultConfig.transformations;

    if (transforms) {
      // Rotate
      if (transforms.rotate && transforms.rotate !== 0) {
        transformer = transformer.rotate(transforms.rotate);
      }

      // Flip vertically
      if (transforms.flip) {
        transformer = transformer.flip();
      }

      // Flop horizontally
      if (transforms.flop) {
        transformer = transformer.flop();
      }

      // Convert to grayscale
      if (transforms.grayscale) {
        transformer = transformer.grayscale();
      }

      // Apply blur
      if (transforms.blur && transforms.blur > 0) {
        transformer = transformer.blur(transforms.blur);
      }

      // Apply sharpening
      if (transforms.sharpen) {
        transformer = transformer.sharpen();
      }

      // Negate (invert colors)
      if (transforms.negate) {
        transformer = transformer.negate();
      }

      // Normalize (enhance contrast)
      if (transforms.normalize) {
        transformer = transformer.normalize();
      }

      // Trim boring pixels
      if (transforms.trim) {
        transformer = transformer.trim();
      }
    }

    // Apply background color for transparency
    if (defaultConfig.background) {
      transformer = transformer.flatten({ background: defaultConfig.background });
    }

    // Handle metadata
    const metadata = defaultConfig.metadata;
    if (metadata?.stripAll) {
      transformer = transformer.withMetadata({
        exif: {},
        icc: undefined,
      });
    } else if (metadata) {
      const metadataOptions: any = {};
      if (!metadata.preserveExif) metadataOptions.exif = {};
      if (!metadata.preserveICC) metadataOptions.icc = undefined;

      if (Object.keys(metadataOptions).length > 0) {
        transformer = transformer.withMetadata(metadataOptions);
      }
    }

    // Resize if dimensions provided
    if (config.width || config.height) {
      // For SVG files, always allow enlargement since they're vector graphics
      // For raster images, respect the withoutEnlargement setting
      const isSvg = extname(inputPath).toLowerCase() === ".svg";
      const allowEnlargement = isSvg ? false : defaultConfig.withoutEnlargement;

      transformer = transformer.resize({
        width: config.width,
        height: config.height,
        fit: config.fit || "inside",
        withoutEnlargement: allowEnlargement,
      });
    }

    // Get compression settings from config
    const compressionSettings = getCompressionSettings(config.format || "webp");

    // Convert format and set quality with advanced compression settings
    switch (config.format) {
      case "jpeg":
        transformer = transformer.jpeg({
          quality: config.quality || (compressionSettings as any).quality,
          progressive: (compressionSettings as any).progressive,
          mozjpeg: (compressionSettings as any).mozjpeg,
          chromaSubsampling: (compressionSettings as any).chromaSubsampling,
          optimizeCoding: (compressionSettings as any).optimizeCoding,
        });
        break;

      case "png":
        transformer = transformer.png({
          quality: config.quality || (compressionSettings as any).quality,
          compressionLevel: (compressionSettings as any).compressionLevel,
          progressive: (compressionSettings as any).progressive,
          palette: (compressionSettings as any).palette,
          colors: (compressionSettings as any).colors,
          adaptiveFiltering: (compressionSettings as any).adaptiveFiltering,
        });
        break;

      case "webp":
        transformer = transformer.webp({
          quality: config.quality || (compressionSettings as any).quality,
          lossless: (compressionSettings as any).lossless,
          effort: (compressionSettings as any).effort,
          nearLossless: (compressionSettings as any).nearLossless,
          smartSubsample: (compressionSettings as any).smartSubsample,
        });
        break;

      case "avif":
        transformer = transformer.avif({
          quality: config.quality || (compressionSettings as any).quality,
          lossless: (compressionSettings as any).lossless,
          effort: (compressionSettings as any).effort,
          chromaSubsampling: (compressionSettings as any).chromaSubsampling,
        });
        break;

      case "tiff":
        transformer = transformer.tiff({
          quality: config.quality || (compressionSettings as any).quality,
          compression: (compressionSettings as any).compression,
          predictor: (compressionSettings as any).predictor,
        });
        break;

      case "gif":
        transformer = transformer.gif({
          colors: (compressionSettings as any).colors,
          dither: (compressionSettings as any).dither,
          effort: (compressionSettings as any).effort,
        });
        break;

      case "heif":
        transformer = transformer.heif({
          quality: config.quality || (compressionSettings as any).quality,
          lossless: (compressionSettings as any).lossless,
          compression: (compressionSettings as any).compression,
          effort: (compressionSettings as any).effort,
        });
        break;

      case "jxl":
        transformer = transformer.jxl({
          quality: config.quality || (compressionSettings as any).quality,
          lossless: (compressionSettings as any).lossless,
          effort: (compressionSettings as any).effort,
        });
        break;
    }

    await transformer.toFile(outputPath);
    return true;
  } catch (error) {
    console.error(`Failed to transform ${inputPath}:`, error);

    // Log error with context
    if (logger) {
      await logger.error("Image transformation failed", error as Error, {
        inputPath,
        outputPath,
        config,
      });
    }

    return false;
  }
}

/**
 * Processes multiple images in batch with parallel processing and circuit breaker protection
 * @param {string[]} files - Array of image filenames to process
 * @param {string} sourceDir - Source directory path
 * @param {string} outputDir - Output directory path
 * @param {TransformConfig} config - Transformation configuration
 * @param {CircuitBreaker} circuitBreaker - Circuit breaker instance for fault tolerance
 * @returns {Promise<{successCount: number, failCount: number, skippedCount: number}>} Processing results
 */
async function processBatch(
  files: string[],
  sourceDir: string,
  outputDir: string,
  config: TransformConfig,
  circuitBreaker: CircuitBreaker,
  logger: Logger
): Promise<{ successCount: number; failCount: number; skippedCount: number }> {
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  const performanceConfig = defaultConfig.performance;
  const isParallel = performanceConfig?.parallel ?? false;
  const maxParallel = performanceConfig?.maxParallel ?? 4;

  if (isParallel) {
    console.log(`⚡ Parallel processing enabled (max ${maxParallel} concurrent)\n`);

    // Process images in chunks for parallel processing
    const chunks = [];
    for (let i = 0; i < files.length; i += maxParallel) {
      chunks.push(files.slice(i, i + maxParallel));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (file) => {
        // Check circuit breaker before processing
        if (!circuitBreaker.canProceed()) {
          console.log(`⏭️  Skipped: ${file} (circuit breaker open)`);
          return { file, status: "skipped" };
        }

        const inputPath = join(sourceDir, file);

        // Preserve directory structure
        const fileDir = require("node:path").dirname(file);
        const fileBaseName = basename(file, extname(file));
        const slugifiedName = slugify(fileBaseName);
        const outputFileName = `${slugifiedName}.${config.format}`;

        // Create output path with same directory structure
        const outputFileRelative = fileDir === "." ? outputFileName : join(fileDir, outputFileName);
        const outputPath = join(outputDir, outputFileRelative);

        // Ensure output subdirectory exists
        const outputSubDir = require("node:path").dirname(outputPath);
        await ensureDirectory(outputSubDir, true);

        console.log(`⚙️  Processing: ${file}...`);

        try {
          const success = await transformImage(inputPath, outputPath, config, logger);

          if (success) {
            circuitBreaker.recordSuccess();
            const inputSize = (await stat(inputPath)).size / 1024;
            const outputSize = (await stat(outputPath)).size / 1024;
            const savings = ((1 - outputSize / inputSize) * 100).toFixed(1);

            console.log(
              `  ✓ Saved: ${outputFileName} (${inputSize.toFixed(1)}KB → ${outputSize.toFixed(1)}KB, ${savings}% reduction)`
            );
            return { file, status: "success" };
          } else {
            circuitBreaker.recordFailure();
            console.log(`  ✗ Failed: ${file}`);
            await logger.error("Image processing failed", new Error("Transform returned false"), {
              file,
              inputPath,
              outputPath,
            });
            return { file, status: "failed" };
          }
        } catch (error) {
          circuitBreaker.recordFailure();
          console.error(`  ✗ Error processing ${file}:`, error);
          await logger.error("Error during batch processing (parallel)", error as Error, {
            file,
            inputPath,
            outputPath,
            config,
          });
          return { file, status: "failed" };
        }
      });

      const results = await Promise.all(promises);

      // Count results
      for (const result of results) {
        if (result.status === "success") successCount++;
        else if (result.status === "failed") failCount++;
        else if (result.status === "skipped") skippedCount++;
      }

      // Check if circuit breaker is open
      const breakerState = circuitBreaker.getState();
      if (breakerState.state === "OPEN") {
        console.error("\n⛔ Circuit breaker opened - stopping batch processing");
        skippedCount += files.length - (successCount + failCount + skippedCount);
        break;
      }
    }
  } else {
    // Sequential processing (original behavior)
    for (const file of files) {
      // Check circuit breaker before processing
      if (!circuitBreaker.canProceed()) {
        console.log(`⏭️  Skipped: ${file} (circuit breaker open)`);
        skippedCount++;
        continue;
      }

      const inputPath = join(sourceDir, file);

      // Preserve directory structure
      const fileDir = require("node:path").dirname(file);
      const fileBaseName = basename(file, extname(file));
      const slugifiedName = slugify(fileBaseName);
      const outputFileName = `${slugifiedName}.${config.format}`;

      // Create output path with same directory structure
      const outputFileRelative = fileDir === "." ? outputFileName : join(fileDir, outputFileName);
      const outputPath = join(outputDir, outputFileRelative);

      // Ensure output subdirectory exists
      const outputSubDir = require("node:path").dirname(outputPath);
      await ensureDirectory(outputSubDir, true);

      console.log(`Processing: ${file}...`);

      try {
        const success = await transformImage(inputPath, outputPath, config, logger);

        if (success) {
          circuitBreaker.recordSuccess();
          const inputSize = (await stat(inputPath)).size / 1024;
          const outputSize = (await stat(outputPath)).size / 1024;
          const savings = ((1 - outputSize / inputSize) * 100).toFixed(1);

          console.log(
            `  ✓ Saved: ${outputFileName} (${inputSize.toFixed(1)}KB → ${outputSize.toFixed(1)}KB, ${savings}% reduction)\n`
          );
          successCount++;
        } else {
          circuitBreaker.recordFailure();
          console.log(`  ✗ Failed\n`);
          await logger.error("Image processing failed", new Error("Transform returned false"), {
            file,
            inputPath,
            outputPath,
          });
          failCount++;
        }
      } catch (error) {
        circuitBreaker.recordFailure();
        console.error(`  ✗ Error processing ${file}:`, error);
        await logger.error("Error during batch processing (sequential)", error as Error, {
          file,
          inputPath,
          outputPath,
          config,
        });
        failCount++;
      }

      // Check if circuit breaker is open
      const breakerState = circuitBreaker.getState();
      if (breakerState.state === "OPEN") {
        console.error("\n⛔ Circuit breaker opened - stopping processing");
        skippedCount += files.length - (successCount + failCount + skippedCount);
        break;
      }
    }
  }

  return { successCount, failCount, skippedCount };
}

/**
 * Main entry point for the image converter CLI
 * Parses arguments, processes images, and handles errors
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Initialize logger
  const logger = new Logger();

  // Parse command line arguments
  const config: TransformConfig = { ...DEFAULT_CONFIG };
  let sourceDir = defaultConfig.sourceDir;
  let outputDir = defaultConfig.outputDir;

  // A simple argument parser to get key-value pairs
  const values: { [key: string]: string | undefined } = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--width":
      case "-w":
        config.width = parseInt(args[++i] || "0", 10);
        break;
      case "--height":
      case "-h":
        config.height = parseInt(args[++i] || "0", 10);
        break;
      case "--format":
      case "-f":
        config.format = (args[++i] || "webp") as TransformConfig["format"];
        break;
      case "--quality":
      case "-q":
        config.quality = parseInt(args[++i] || "80", 10);
        break;
      case "--fit":
        config.fit = (args[++i] || "inside") as TransformConfig["fit"];
        break;
      case "--source":
      case "-s":
        sourceDir = args[++i] || "./raw";
        break;
      case "--output":
      case "-o":
        outputDir = args[++i] || "./results";
        break;
      case "--clean": {
        const cleanSourceDir = args[i + 1] || sourceDir;
        const cleanOutputDir = args[i + 2] || outputDir;

        console.log("\n🧹 Cleaning up directories...\n");

        const rawCount = await cleanDirectory(cleanSourceDir);
        const resultsCount = await cleanDirectory(cleanOutputDir);

        console.log(`✓ Removed ${rawCount} file(s) from ${cleanSourceDir}`);
        console.log(`✓ Removed ${resultsCount} file(s) from ${cleanOutputDir}\n`);
        process.exit(0);
        break;
      }
      case "--clear-logs":
      case "--reset": {
        console.log("\n🧹 Clearing log files...\n");

        const logCount = await logger.clearLogs();

        console.log(`✓ Removed ${logCount} log file(s)\n`);
        process.exit(0);
        break;
      }
      case "--help":
        console.log(`
Image Converter - Transform images in bulk using Bun and Sharp

Usage: bun run imgco [options]

Options:
  -w, --width <number>      Width in pixels (default: auto - maintains original/aspect ratio)
  -h, --height <number>     Height in pixels (default: auto - maintains original/aspect ratio)
  -f, --format <format>     Output format: jpeg, png, webp, avif, tiff, gif, heif, jxl (default: webp)
  -q, --quality <number>    Quality 1-100 (default: 80)
  --fit <mode>              Resize fit mode: cover, contain, fill, inside, outside (default: inside)
  -s, --source <path>       Source directory (default: ./raw)
  -o, --output <path>       Output directory (default: ./results)
  --clean [source] [output] Clean up files in directories (optional: specify directories)
  --clear-logs, --reset     Clear all log files
  --help                    Show this help message

Supported Input Formats:
  JPEG (.jpg, .jpeg), PNG (.png), WebP (.webp), GIF (.gif), SVG (.svg),
  TIFF (.tiff, .tif), AVIF (.avif), HEIF (.heif, .heic), JPEG XL (.jxl), BMP (.bmp)

Supported Output Formats:
  - jpeg  : JPEG (lossy, wide compatibility)
  - png   : PNG (lossless, transparency support)
  - webp  : WebP (modern, best balance)
  - avif  : AVIF (next-gen, best compression)
  - tiff  : TIFF (archival, print-ready)
  - gif   : GIF (animated support, limited colors)
  - heif  : HEIF/HEIC (Apple ecosystem)
  - jxl   : JPEG XL (next-gen, royalty-free)

Examples:
  bun run imgco
  bun run imgco --width 800 --height 600 --format jpeg --quality 90
  bun run imgco -w 1200 -f webp -q 85
  bun run imgco --format avif --quality 75
  bun run imgco --source ./photos --output ./optimized
  bun run imgco --clean                    # Clean default directories
  bun run imgco --clean ./raw ./results    # Clean specific directories

Advanced Features (edit config.ts for):
  - Image transformations (rotate, flip, grayscale, blur, sharpen)
  - Metadata preservation (EXIF, ICC profiles)
  - Background color for transparency
  - Parallel processing for speed
  - Format-specific compression settings
  - 12 presets (highQuality, web, thumbnail, socialMedia, favicon, etc.)
        `);
        process.exit(0);
    }
  }

  console.log("\n🖼️  Image Converter Starting...\n");
  console.log("Configuration:");
  console.log(`  Source: ${sourceDir}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Format: ${config.format}`);
  console.log(`  Size: ${config.width || "auto"}x${config.height || "auto"}`);
  console.log(`  Quality: ${config.quality}`);
  console.log(`  Fit: ${config.fit}\n`);

  // Ensure directories exist
  await ensureDirectory(sourceDir);
  await ensureDirectory(outputDir);

  // Get all image files
  const imageFiles = await getImageFiles(sourceDir);

  if (imageFiles.length === 0) {
    console.log(`⚠️  No images found in ${sourceDir}`);
    console.log(`Supported formats: ${SUPPORTED_FORMATS.join(", ")}`);
    return;
  }

  console.log(`Found ${imageFiles.length} image(s) to process\n`);

  // Log processing start
  await logger.info("Image conversion started", {
    totalFiles: imageFiles.length,
    sourceDir,
    outputDir,
    config,
  });

  // Initialize circuit breaker for fault tolerance
  const circuitBreaker = new CircuitBreaker(5, 30000); // 5 failures, 30s timeout

  // Process images with batch processing (supports parallel + circuit breaker)
  const { successCount, failCount, skippedCount } = await processBatch(
    imageFiles,
    sourceDir,
    outputDir,
    config,
    circuitBreaker,
    logger
  );

  // Display final results
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✨ Complete! Processed ${successCount}/${imageFiles.length} images`);

  if (failCount > 0) {
    console.log(`⚠️  ${failCount} image(s) failed to process`);
  }

  if (skippedCount > 0) {
    console.log(`⏭️  ${skippedCount} image(s) skipped (circuit breaker)`);
  }

  const breakerState = circuitBreaker.getState();
  console.log(`\n📊 Circuit Breaker Stats:`);
  console.log(`   State: ${breakerState.state}`);
  console.log(`   Successes: ${breakerState.successes}`);
  console.log(`   Failures: ${breakerState.failures}`);

  console.log(`${"=".repeat(50)}\n`);

  // Log processing complete
  await logger.info("Image conversion completed", {
    totalFiles: imageFiles.length,
    successCount,
    failCount,
    skippedCount,
    circuitBreakerState: breakerState,
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
