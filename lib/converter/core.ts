import { stat } from "node:fs/promises";
import { extname } from "node:path";
import sharp from "sharp";
import { defaultConfig, getCompressionSettings } from "../../config";
import type { ConversionOptions, ConversionResult } from "./types";

/**
 * Core image conversion function
 * Transforms a single image with specified options
 * Supports all format conversions, transformations, and optimizations
 *
 * @param inputPath - Path to source image file (or Buffer for web uploads)
 * @param outputPath - Path for output file
 * @param options - Conversion options
 * @returns Promise<ConversionResult> - Conversion result with statistics
 *
 * @example
 * const result = await convertImage("./input.jpg", "./output.webp", {
 *   format: "webp",
 *   quality: 80,
 *   width: 800,
 *   fit: "inside"
 * });
 */
export async function convertImage(
  inputPath: string | Buffer,
  outputPath: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  try {
    const startTime = Date.now();

    // Get original file size
    let originalSize = 0;
    if (typeof inputPath === "string") {
      originalSize = (await stat(inputPath)).size;
    } else {
      originalSize = inputPath.length;
    }

    // Initialize Sharp transformer
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
    if (options.width || options.height) {
      // For SVG files, always allow enlargement since they're vector graphics
      // For raster images, respect the withoutEnlargement setting
      const isSvg = typeof inputPath === "string" && extname(inputPath).toLowerCase() === ".svg";
      const allowEnlargement = isSvg ? false : defaultConfig.withoutEnlargement;

      transformer = transformer.resize({
        width: options.width,
        height: options.height,
        fit: options.fit || "inside",
        withoutEnlargement: allowEnlargement,
      });
    }

    // Get compression settings from config
    const compressionSettings = getCompressionSettings(options.format);

    // Convert format and set quality with advanced compression settings
    switch (options.format) {
      case "jpeg":
        transformer = transformer.jpeg({
          quality: options.quality || (compressionSettings as any).quality,
          progressive: (compressionSettings as any).progressive,
          mozjpeg: (compressionSettings as any).mozjpeg,
          chromaSubsampling: (compressionSettings as any).chromaSubsampling,
          optimizeCoding: (compressionSettings as any).optimizeCoding,
        });
        break;

      case "png":
        transformer = transformer.png({
          quality: options.quality || (compressionSettings as any).quality,
          compressionLevel: (compressionSettings as any).compressionLevel,
          progressive: (compressionSettings as any).progressive,
          palette: (compressionSettings as any).palette,
          colors: (compressionSettings as any).colors,
          adaptiveFiltering: (compressionSettings as any).adaptiveFiltering,
        });
        break;

      case "webp":
        transformer = transformer.webp({
          quality: options.quality || (compressionSettings as any).quality,
          lossless: (compressionSettings as any).lossless,
          effort: (compressionSettings as any).effort,
          nearLossless: (compressionSettings as any).nearLossless,
          smartSubsample: (compressionSettings as any).smartSubsample,
        });
        break;

      case "avif":
        transformer = transformer.avif({
          quality: options.quality || (compressionSettings as any).quality,
          lossless: (compressionSettings as any).lossless,
          effort: (compressionSettings as any).effort,
          chromaSubsampling: (compressionSettings as any).chromaSubsampling,
        });
        break;

      case "tiff":
        transformer = transformer.tiff({
          quality: options.quality || (compressionSettings as any).quality,
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
          quality: options.quality || (compressionSettings as any).quality,
          lossless: (compressionSettings as any).lossless,
          compression: (compressionSettings as any).compression,
          effort: (compressionSettings as any).effort,
        });
        break;

      case "jxl":
        transformer = transformer.jxl({
          quality: options.quality || (compressionSettings as any).quality,
          lossless: (compressionSettings as any).lossless,
          effort: (compressionSettings as any).effort,
        });
        break;
    }

    // Save output file
    await transformer.toFile(outputPath);

    // Get converted file size
    const convertedSize = (await stat(outputPath)).size;

    // Calculate reduction
    const reductionPercent = (1 - convertedSize / originalSize) * 100;

    const _processingTime = Date.now() - startTime;

    return {
      success: true,
      outputPath,
      originalSize,
      convertedSize,
      reductionPercent,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Slugify filename for URL safety
 * Converts filename to lowercase, replaces spaces and special chars with hyphens
 *
 * @param text - Filename to slugify
 * @returns URL-safe filename
 *
 * @example
 * slugifyFilename("My Photo 2024!.jpg") // "my-photo-2024"
 */
export function slugifyFilename(text: string): string {
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
