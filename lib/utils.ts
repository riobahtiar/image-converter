import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 * Uses clsx for conditional classes and tailwind-merge to handle conflicts
 * @param inputs - Class values to merge
 * @returns Merged class string
 * @example
 * cn("px-2 py-1", condition && "bg-blue-500", "text-white")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format bytes to human readable format
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with units (B, KB, MB, GB)
 * @example
 * formatBytes(1024) // "1.00 KB"
 * formatBytes(1048576) // "1.00 MB"
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Generate a unique filename with timestamp and random string
 * @param originalName - Original filename
 * @returns Unique filename
 * @example
 * generateUniqueFilename("image.jpg") // "1234567890-abc123-image.jpg"
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split(".").pop();
  const name = originalName.replace(`.${ext}`, "");
  return `${timestamp}-${random}-${name}.${ext}`;
}
