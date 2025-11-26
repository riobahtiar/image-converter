/**
 * Image Conversion Configuration Interface
 *
 * Defines all configurable options for image processing including dimensions,
 * format, quality, transformations, metadata handling, and performance settings.
 *
 * @interface ConversionConfig
 * @example
 * const config: ConversionConfig = {
 *   width: 1920,
 *   height: 1080,
 *   format: "webp",
 *   quality: 80,
 *   fit: "inside",
 *   // ... other options
 * };
 */
export interface ConversionConfig {
  // Image dimensions
  width?: number;
  height?: number;

  // Output format - Supports most popular image formats
  format: "jpeg" | "png" | "webp" | "avif" | "tiff" | "gif" | "heif" | "jxl";

  // Quality settings (1-100)
  quality: number;

  // Resize behavior
  fit: "cover" | "contain" | "fill" | "inside" | "outside";

  // Prevent image enlargement
  withoutEnlargement: boolean;

  // Preserve aspect ratio
  preserveAspectRatio: boolean;

  // Directory paths
  sourceDir: string;
  outputDir: string;

  // Image transformations
  transformations?: {
    rotate?: number; // Rotation angle in degrees (0, 90, 180, 270)
    flip?: boolean; // Flip vertically
    flop?: boolean; // Flip horizontally
    grayscale?: boolean; // Convert to grayscale
    blur?: number; // Blur sigma (0.3 to 1000)
    sharpen?: boolean; // Apply sharpening
    negate?: boolean; // Invert colors
    normalize?: boolean; // Enhance contrast by stretching luminance
    trim?: boolean; // Trim "boring" pixels from edges
  };

  // Metadata options
  metadata?: {
    preserveExif?: boolean; // Keep EXIF data (camera info, GPS, etc.)
    preserveICC?: boolean; // Keep color profile
    stripAll?: boolean; // Remove all metadata (overrides preserve options)
  };

  // Background color for images with transparency
  background?: { r: number; g: number; b: number; alpha?: number };

  // Performance settings
  performance?: {
    parallel?: boolean; // Process images in parallel
    maxParallel?: number; // Maximum parallel processes (default: CPU cores)
  };

  // Compression settings
  compression: {
    jpeg: {
      quality: number;
      progressive: boolean;
      mozjpeg: boolean;
      chromaSubsampling?: string; // '4:4:4', '4:2:2', '4:2:0'
      optimizeCoding?: boolean;
    };
    png: {
      quality: number;
      compressionLevel: number;
      progressive: boolean;
      palette?: boolean; // Use 8-bit palette
      colors?: number; // Max colors if palette is true (2-256)
      adaptiveFiltering?: boolean;
    };
    webp: {
      quality: number;
      lossless: boolean;
      effort: number; // 0-6, higher = better compression but slower
      nearLossless?: boolean; // Near lossless compression
      smartSubsample?: boolean; // Use smart chroma subsampling
    };
    avif: {
      quality: number;
      lossless: boolean;
      effort: number; // 0-9, higher = better compression but slower
      chromaSubsampling?: string; // '4:4:4', '4:2:2', '4:2:0'
    };
    tiff: {
      quality: number;
      compression: "lzw" | "deflate" | "jpeg" | "none";
      predictor?: "none" | "horizontal" | "float"; // Compression predictor
    };
    gif: {
      colors?: number; // Max colors (2-256, default 256)
      dither?: number; // Dithering level (0-1)
      effort?: number; // CPU effort (1-10)
    };
    heif: {
      quality: number;
      lossless: boolean;
      compression?: "hevc" | "av1"; // Compression format
      effort?: number; // 0-9
    };
    jxl: {
      quality: number;
      lossless: boolean;
      effort: number; // 3-9, higher = better compression
      decodingSpeed?: number; // 0-4, higher = faster decode
    };
  };
}

/**
 * Default Configuration
 *
 * These are the default settings used when no CLI arguments are provided.
 */
export const defaultConfig: ConversionConfig = {
  // Image dimensions (undefined = auto)
  width: 1920,
  height: 1080,

  // Output format - WebP is recommended for best compression/quality ratio
  format: "webp",

  // Default quality (1-100)
  // 80 is a good balance between quality and file size
  quality: 80,

  // Fit mode - "inside" preserves aspect ratio and fits within dimensions
  fit: "inside",

  // Don't enlarge images if they're smaller than target dimensions
  withoutEnlargement: true,

  // Always preserve aspect ratio
  preserveAspectRatio: true,

  // Source and output directories
  sourceDir: "./raw",
  outputDir: "./results",

  // Image transformations (disabled by default)
  transformations: {
    rotate: 0,
    flip: false,
    flop: false,
    grayscale: false,
    blur: 0,
    sharpen: false,
    negate: false,
    normalize: false,
    trim: false,
  },

  // Metadata options (strip all by default for smaller files)
  metadata: {
    preserveExif: false,
    preserveICC: false,
    stripAll: true,
  },

  // Background color (white) for transparent images
  background: { r: 255, g: 255, b: 255, alpha: 1 },

  // Performance settings (sequential by default for stability)
  performance: {
    parallel: false,
    maxParallel: 4,
  },

  // Format-specific compression settings
  compression: {
    // JPEG settings
    jpeg: {
      quality: 80,
      progressive: true, // Progressive JPEGs load faster on web
      mozjpeg: true,     // Use MozJPEG for better compression
      chromaSubsampling: "4:2:0", // Good balance of quality/size
      optimizeCoding: true,
    },

    // PNG settings
    png: {
      quality: 80,
      compressionLevel: 9, // 0-9, higher = better compression
      progressive: true,
      palette: false,
      adaptiveFiltering: true,
    },

    // WebP settings (recommended)
    webp: {
      quality: 80,
      lossless: false,  // Set to true for lossless compression
      effort: 4,        // 0-6, 4 is a good balance
      nearLossless: false,
      smartSubsample: true,
    },

    // AVIF settings (best compression, slower)
    avif: {
      quality: 75,      // AVIF can use lower quality for same visual quality
      lossless: false,
      effort: 4,        // 0-9, 4 is a good balance
      chromaSubsampling: "4:2:0",
    },

    // TIFF settings
    tiff: {
      quality: 80,
      compression: "lzw", // "lzw" | "deflate" | "jpeg" | "none"
      predictor: "horizontal",
    },

    // GIF settings (for animated GIFs)
    gif: {
      colors: 256,      // Max colors (2-256)
      dither: 1.0,      // Full dithering for better quality
      effort: 7,        // CPU effort (1-10)
    },

    // HEIF/HEIC settings (Apple format)
    heif: {
      quality: 80,
      lossless: false,
      compression: "hevc", // HEVC (H.265) compression
      effort: 4,
    },

    // JPEG XL settings (next-gen format)
    jxl: {
      quality: 80,
      lossless: false,
      effort: 7,        // 3-9, higher = better compression
      decodingSpeed: 0, // 0-4, 0 = optimize for size
    },
  },
};

/**
 * Preset configurations for common use cases
 */
export const presets = {
  // High quality for print or archival
  highQuality: {
    ...defaultConfig,
    quality: 95,
    metadata: {
      preserveExif: true,
      preserveICC: true,
      stripAll: false,
    },
    compression: {
      ...defaultConfig.compression,
      webp: { quality: 95, lossless: false, effort: 6, nearLossless: false, smartSubsample: true },
      avif: { quality: 90, lossless: false, effort: 6, chromaSubsampling: "4:4:4" },
      jpeg: { quality: 95, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4", optimizeCoding: true },
      png: { quality: 95, compressionLevel: 9, progressive: true, palette: false, adaptiveFiltering: true },
    },
  },

  // Optimized for web (smaller file sizes, fast loading)
  web: {
    ...defaultConfig,
    width: 1920,
    height: 1080,
    quality: 75,
    compression: {
      ...defaultConfig.compression,
      webp: { quality: 75, lossless: false, effort: 4, nearLossless: false, smartSubsample: true },
      avif: { quality: 70, lossless: false, effort: 4, chromaSubsampling: "4:2:0" },
      jpeg: { quality: 75, progressive: true, mozjpeg: true, chromaSubsampling: "4:2:0", optimizeCoding: true },
    },
  },

  // Thumbnails
  thumbnail: {
    ...defaultConfig,
    width: 300,
    height: 300,
    fit: "cover" as const,
    quality: 75,
    transformations: {
      ...defaultConfig.transformations,
      sharpen: true, // Sharpen thumbnails for better appearance
    },
  },

  // Maximum compression (smaller files, some quality loss)
  maxCompression: {
    ...defaultConfig,
    quality: 60,
    compression: {
      ...defaultConfig.compression,
      webp: { quality: 60, lossless: false, effort: 6, nearLossless: false, smartSubsample: true },
      avif: { quality: 55, lossless: false, effort: 6, chromaSubsampling: "4:2:0" },
      jpeg: { quality: 60, progressive: true, mozjpeg: true, chromaSubsampling: "4:2:0", optimizeCoding: true },
    },
  },

  // Lossless (no quality loss, larger files)
  lossless: {
    ...defaultConfig,
    quality: 100,
    metadata: {
      preserveExif: true,
      preserveICC: true,
      stripAll: false,
    },
    compression: {
      ...defaultConfig.compression,
      webp: { quality: 100, lossless: true, effort: 6, nearLossless: false, smartSubsample: true },
      png: { quality: 100, compressionLevel: 9, progressive: true, palette: false, adaptiveFiltering: true },
      avif: { quality: 100, lossless: true, effort: 6, chromaSubsampling: "4:4:4" },
    },
  },

  // Social Media (optimized for Facebook, Instagram, Twitter)
  socialMedia: {
    ...defaultConfig,
    width: 1200,
    height: 630, // Open Graph standard size
    fit: "cover" as const,
    quality: 85,
    format: "jpeg" as const,
    compression: {
      ...defaultConfig.compression,
      jpeg: { quality: 85, progressive: true, mozjpeg: true, chromaSubsampling: "4:2:0", optimizeCoding: true },
    },
  },

  // Favicon (small icon sizes)
  favicon: {
    ...defaultConfig,
    width: 32,
    height: 32,
    fit: "cover" as const,
    quality: 90,
    format: "png" as const,
    transformations: {
      ...defaultConfig.transformations,
      sharpen: true,
    },
    compression: {
      ...defaultConfig.compression,
      png: { quality: 90, compressionLevel: 9, progressive: false, palette: true, colors: 256, adaptiveFiltering: true },
    },
  },

  // Retina (2x resolution for high DPI displays)
  retina: {
    ...defaultConfig,
    width: 3840, // 2x of 1920
    height: 2160, // 2x of 1080
    quality: 85,
    compression: {
      ...defaultConfig.compression,
      webp: { quality: 85, lossless: false, effort: 5, nearLossless: false, smartSubsample: true },
      avif: { quality: 80, lossless: false, effort: 5, chromaSubsampling: "4:2:0" },
    },
  },

  // Email (smaller file sizes for email compatibility)
  email: {
    ...defaultConfig,
    width: 600,
    height: 800,
    quality: 70,
    format: "jpeg" as const,
    compression: {
      ...defaultConfig.compression,
      jpeg: { quality: 70, progressive: false, mozjpeg: true, chromaSubsampling: "4:2:0", optimizeCoding: true },
    },
  },

  // Print (high quality, CMYK-ready)
  print: {
    ...defaultConfig,
    width: undefined, // Keep original size
    height: undefined,
    quality: 100,
    format: "tiff" as const,
    metadata: {
      preserveExif: true,
      preserveICC: true,
      stripAll: false,
    },
    compression: {
      ...defaultConfig.compression,
      tiff: { quality: 100, compression: "lzw", predictor: "horizontal" },
    },
  },

  // Mobile (optimized for mobile devices)
  mobile: {
    ...defaultConfig,
    width: 800,
    height: 1200,
    quality: 75,
    compression: {
      ...defaultConfig.compression,
      webp: { quality: 75, lossless: false, effort: 4, nearLossless: false, smartSubsample: true },
      avif: { quality: 70, lossless: false, effort: 4, chromaSubsampling: "4:2:0" },
    },
  },

  // Grayscale (black and white conversion)
  grayscale: {
    ...defaultConfig,
    quality: 80,
    transformations: {
      ...defaultConfig.transformations,
      grayscale: true,
      normalize: true, // Enhance contrast
    },
  },

  // Speed (fastest processing, lower quality)
  speed: {
    ...defaultConfig,
    quality: 70,
    performance: {
      parallel: true,
      maxParallel: 8,
    },
    compression: {
      ...defaultConfig.compression,
      webp: { quality: 70, lossless: false, effort: 1, nearLossless: false, smartSubsample: true },
      avif: { quality: 65, lossless: false, effort: 1, chromaSubsampling: "4:2:0" },
      jpeg: { quality: 70, progressive: true, mozjpeg: false, chromaSubsampling: "4:2:0", optimizeCoding: false },
    },
  },
};

/**
 * Retrieves format-specific compression settings from default configuration
 *
 * Returns optimized compression parameters for the specified image format
 * including quality, effort levels, and format-specific options.
 *
 * @param {ConversionConfig["format"]} format - Target image format
 * @returns {Object} Compression settings for the specified format
 * @example
 * const webpSettings = getCompressionSettings("webp");
 * // Returns: { quality: 80, lossless: false, effort: 4, ... }
 */
export function getCompressionSettings(format: ConversionConfig["format"]) {
  return defaultConfig.compression[format];
}
