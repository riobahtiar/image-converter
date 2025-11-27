/**
 * Client-side Image Compression Utility
 *
 * Lazy-loaded compression using browser-image-compression library.
 * This reduces upload size before sending files to the server.
 *
 * Benefits:
 * - 40-60% reduction in upload size
 * - Faster uploads on slow connections
 * - Reduced server bandwidth
 * - Better UX for users with large files
 *
 * Uses Islands Architecture pattern - only loaded when needed
 */

export interface ClientCompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  initialQuality?: number;
  onProgress?: (progress: number) => void;
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
}

/**
 * Lazy-loaded compression function
 * Only imports the library when actually called
 */
export async function compressImageClient(
  file: File,
  options: ClientCompressionOptions = {}
): Promise<CompressionResult> {
  // Dynamic import - only loaded when this function is called
  const imageCompression = (await import("browser-image-compression")).default;

  const {
    maxSizeMB = 5,
    maxWidthOrHeight = 3840,
    useWebWorker = true,
    initialQuality = 0.8,
    onProgress,
  } = options;

  const originalSize = file.size;

  // Skip compression for small files (< 500KB)
  if (originalSize < 500 * 1024) {
    return {
      compressedFile: file,
      originalSize,
      compressedSize: originalSize,
      reductionPercent: 0,
    };
  }

  try {
    const compressionOptions = {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker,
      initialQuality,
      fileType: file.type,
      onProgress: onProgress
        ? (progress: number) => {
            // Progress is 0-100
            onProgress(progress);
          }
        : undefined,
    };

    console.log("[CLIENT COMPRESSION] Starting compression", {
      filename: file.name,
      originalSize,
      options: compressionOptions,
    });

    const compressedBlob = await imageCompression(file, compressionOptions);

    // Preserve original filename - browser-image-compression returns a Blob without name
    // Convert to File with original filename
    const compressedFile = new File([compressedBlob], file.name, {
      type: compressedBlob.type || file.type,
      lastModified: Date.now(),
    });

    const compressedSize = compressedFile.size;
    const reductionPercent = ((originalSize - compressedSize) / originalSize) * 100;

    console.log("[CLIENT COMPRESSION] Compression completed", {
      filename: file.name,
      originalSize,
      compressedSize,
      reductionPercent: `${reductionPercent.toFixed(2)}%`,
    });

    return {
      compressedFile,
      originalSize,
      compressedSize,
      reductionPercent,
    };
  } catch (error) {
    console.error("[CLIENT COMPRESSION] Compression failed", {
      filename: file.name,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Return original file if compression fails
    return {
      compressedFile: file,
      originalSize,
      compressedSize: originalSize,
      reductionPercent: 0,
    };
  }
}

/**
 * Batch compress multiple files with progress tracking
 */
export async function compressImagesClientBatch(
  files: File[],
  options: ClientCompressionOptions & {
    onFileProgress?: (index: number, total: number, filename: string) => void;
  } = {}
): Promise<CompressionResult[]> {
  const { onFileProgress, ...compressionOptions } = options;

  const results: CompressionResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    if (onFileProgress) {
      onFileProgress(i + 1, files.length, file.name);
    }

    const result = await compressImageClient(file, compressionOptions);
    results.push(result);
  }

  return results;
}

/**
 * Check if a file should be compressed
 * Skip SVG, very small files, and already compressed formats
 */
export function shouldCompressFile(file: File): boolean {
  const filename = file.name.toLowerCase();

  // Skip SVG files (vector graphics)
  if (filename.endsWith(".svg")) {
    return false;
  }

  // Skip very small files (< 500KB)
  if (file.size < 500 * 1024) {
    return false;
  }

  // Skip already highly compressed formats
  const skipFormats = [".webp", ".avif", ".jxl"];
  if (skipFormats.some((ext) => filename.endsWith(ext))) {
    return false;
  }

  return true;
}

/**
 * Get optimal compression settings based on file size
 */
export function getOptimalCompressionSettings(fileSize: number): ClientCompressionOptions {
  // Very large files (> 10MB) - aggressive compression
  if (fileSize > 10 * 1024 * 1024) {
    return {
      maxSizeMB: 5,
      maxWidthOrHeight: 2560,
      useWebWorker: true,
      initialQuality: 0.7,
    };
  }

  // Large files (5-10MB) - moderate compression
  if (fileSize > 5 * 1024 * 1024) {
    return {
      maxSizeMB: 5,
      maxWidthOrHeight: 3840,
      useWebWorker: true,
      initialQuality: 0.75,
    };
  }

  // Medium files (1-5MB) - light compression
  return {
    maxSizeMB: 5,
    maxWidthOrHeight: 3840,
    useWebWorker: true,
    initialQuality: 0.8,
  };
}
