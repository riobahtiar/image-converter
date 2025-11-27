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

/**
 * Check if a file is an SVG based on its extension
 * @param filename - Filename to check
 * @returns True if file has .svg extension
 */
export function isSvgFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".svg");
}

/**
 * Validate SVG file on client side before upload
 * Performs basic checks that can be done without server-side scanning
 * @param file - File to validate
 * @returns Validation result with warnings
 */
export async function validateSvgFile(file: File): Promise<{
  valid: boolean;
  warnings: string[];
  error?: string;
}> {
  const warnings: string[] = [];

  if (!isSvgFile(file.name)) {
    return {
      valid: false,
      warnings: [],
      error: "File is not an SVG",
    };
  }

  // Check file size
  if (file.size > 5 * 1024 * 1024) {
    // 5MB limit
    return {
      valid: false,
      warnings: [],
      error: "SVG file too large (max 5MB)",
    };
  }

  if (file.size < 100) {
    return {
      valid: false,
      warnings: [],
      error: "SVG file too small (min 100 bytes)",
    };
  }

  try {
    // Read file content for basic validation
    const text = await file.text();

    // Check for basic SVG structure
    if (!text.includes("<svg") && !text.includes("<?xml")) {
      return {
        valid: false,
        warnings: [],
        error: "File does not contain valid SVG content",
      };
    }

    // Basic security warnings (client-side only - server does full scan)
    if (text.includes("<script")) {
      warnings.push("SVG contains script tags - will be scanned for security");
    }

    if (text.includes("javascript:")) {
      warnings.push("SVG contains JavaScript references - will be scanned for security");
    }

    if (text.includes("on") && /on\w+\s*=/.test(text)) {
      warnings.push("SVG contains event handlers - will be scanned for security");
    }

    if (text.includes("http://") || text.includes("https://")) {
      warnings.push("SVG contains external references - will be validated");
    }

    // Add general warning for SVG files
    warnings.push("SVG files will be automatically scanned for malicious content");

    return {
      valid: true,
      warnings,
    };
  } catch (error) {
    return {
      valid: false,
      warnings: [],
      error: "Failed to read SVG file content",
    };
  }
}

/**
 * Get security level description for display
 * @param level - Security level string
 * @returns Human-readable description
 */
export function getSecurityLevelDisplayName(level: string): string {
  switch (level.toLowerCase()) {
    case "permissive":
      return "Permissive (Minimal Security)";
    case "moderate":
      return "Moderate (Recommended)";
    case "strict":
      return "Strict (Maximum Security)";
    default:
      return level;
  }
}

/**
 * Get threat type display name
 * @param type - Threat type string
 * @returns Human-readable name
 */
export function getThreatTypeDisplayName(type: string): string {
  const typeMap: Record<string, string> = {
    script: "Script/JavaScript",
    event_handler: "Event Handler",
    external_reference: "External Reference",
    data_uri: "Data URI",
    foreign_object: "Foreign Object",
    animation: "Animation",
    embedded_content: "Embedded Content",
    external_link: "External Link",
    deprecated_element: "Deprecated Element",
    processing_instruction: "Processing Instruction",
    doctype: "Document Type",
    xml_entity: "XML Entity",
  };

  return typeMap[type] || type.replace("_", " ");
}

/**
 * Get severity color class for UI display
 * @param severity - Severity number (1-10)
 * @returns Tailwind color class
 */
export function getSeverityColorClass(severity: number): string {
  if (severity >= 9) {
    return "text-red-600 dark:text-red-400";
  } else if (severity >= 7) {
    return "text-orange-600 dark:text-orange-400";
  } else if (severity >= 5) {
    return "text-yellow-600 dark:text-yellow-400";
  } else {
    return "text-blue-600 dark:text-blue-400";
  }
}
