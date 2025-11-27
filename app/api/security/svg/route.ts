import { type NextRequest, NextResponse } from "next/server";
import { checkRateLimit, sessionRateLimiter } from "@/lib/ratelimit";
import { getSession } from "@/lib/session";
import {
  generateSecurityReport,
  getSecurityLevelDescription,
  SvgSecurityLevel,
  scanSvgSecurity,
} from "@/lib/svgSecurity";

/**
 * Maximum SVG file size for security scanning (5MB)
 */
const MAX_SVG_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/security/svg
 * Scan SVG file for security threats
 *
 * Accepts multipart/form-data with:
 * - file: SVG file to scan
 * - securityLevel: Security level (permissive|moderate|strict) - optional, defaults to moderate
 * - sanitize: Whether to attempt sanitization - optional, defaults to false
 *
 * Returns JSON with security scan results
 */
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log("[SVG Security] Scan request received", {
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get("user-agent"),
  });

  try {
    // ========================================
    // Step 1: Session Management & Rate Limiting
    // ========================================
    const session = await getSession();
    console.log("[SVG Security] Session initialized", {
      sessionId: session.sessionId,
    });

    const rateLimitResult = await checkRateLimit(
      session.sessionId,
      "security-scan",
      sessionRateLimiter
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many security scans. Please try again in ${rateLimitResult.retryAfter} seconds.`,
        },
        {
          status: 429,
          headers: rateLimitResult.headers,
        }
      );
    }

    // ========================================
    // Step 2: Parse Form Data
    // ========================================
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Parse security level
    const securityLevelParam = formData.get("securityLevel") as string;
    let securityLevel: SvgSecurityLevel = SvgSecurityLevel.MODERATE;

    if (securityLevelParam) {
      if (Object.values(SvgSecurityLevel).includes(securityLevelParam as SvgSecurityLevel)) {
        securityLevel = securityLevelParam as SvgSecurityLevel;
      } else {
        return NextResponse.json(
          {
            error: `Invalid security level: ${securityLevelParam}. Valid values: ${Object.values(SvgSecurityLevel).join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Parse sanitize option
    const sanitizeParam = formData.get("sanitize") as string;
    const sanitize = sanitizeParam === "true";

    console.log("[SVG Security] Scan parameters", {
      filename: file.name,
      size: file.size,
      securityLevel,
      sanitize,
    });

    // ========================================
    // Step 3: File Validation
    // ========================================
    if (file.size > MAX_SVG_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_SVG_SIZE / 1024 / 1024}MB (${(file.size / 1024 / 1024).toFixed(2)}MB provided)`,
        },
        { status: 413 }
      );
    }

    if (file.size < 100) {
      return NextResponse.json(
        { error: "File too small. Minimum size is 100 bytes" },
        { status: 400 }
      );
    }

    // Check file extension
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "svg") {
      return NextResponse.json({ error: "File must have .svg extension" }, { status: 400 });
    }

    // ========================================
    // Step 4: Read File Content
    // ========================================
    const arrayBuffer = await file.arrayBuffer();
    const content = new TextDecoder().decode(arrayBuffer);

    // Basic SVG content validation
    if (!content.includes("<svg") && !content.includes("<?xml")) {
      return NextResponse.json(
        { error: "File doesn't contain valid SVG content" },
        { status: 400 }
      );
    }

    // ========================================
    // Step 5: Perform Security Scan
    // ========================================
    console.log("[SVG Security] Starting security scan", {
      filename: file.name,
      contentLength: content.length,
      securityLevel,
    });

    const scanResult = await scanSvgSecurity(content, securityLevel, {
      sanitize,
      maxSize: MAX_SVG_SIZE,
    });

    const scanDuration = Date.now() - requestStartTime;
    console.log("[SVG Security] Scan completed", {
      filename: file.name,
      duration: `${scanDuration}ms`,
      safe: scanResult.safe,
      threatsFound: scanResult.threats.length,
      sanitized: scanResult.sanitized,
    });

    // ========================================
    // Step 6: Generate Response
    // ========================================
    const response = {
      success: true,
      file: {
        name: file.name,
        size: file.size,
        originalSize: scanResult.originalSize,
      },
      security: {
        safe: scanResult.safe,
        level: scanResult.securityLevel,
        levelDescription: getSecurityLevelDescription(scanResult.securityLevel),
        threatsFound: scanResult.threats.length,
        blockingThreats: scanResult.threats.filter((t) => t.blocking).length,
        nonBlockingThreats: scanResult.threats.filter((t) => !t.blocking).length,
        threats: scanResult.threats.map((threat) => ({
          type: threat.type,
          severity: threat.severity,
          description: threat.description,
          blocking: threat.blocking,
          content: threat.content ? threat.content.substring(0, 200) : undefined,
        })),
      },
      sanitization: scanResult.sanitized
        ? {
            performed: true,
            sizeBefore: scanResult.originalSize,
            sizeAfter: scanResult.sanitizedSize || 0,
            reduction: scanResult.sanitizedSize
              ? Math.round(
                  ((scanResult.originalSize - scanResult.sanitizedSize) / scanResult.originalSize) *
                    100
                )
              : 0,
          }
        : {
            performed: false,
          },
      report: generateSecurityReport(scanResult),
      sessionId: session.sessionId,
    };

    // Include sanitized content if available and requested
    if (scanResult.sanitized && scanResult.sanitizedContent && sanitize) {
      (response as any).sanitizedContent = scanResult.sanitizedContent;
    }

    return NextResponse.json(response, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    const scanDuration = Date.now() - requestStartTime;
    console.error("[SVG Security] Scan error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      duration: `${scanDuration}ms`,
    });

    return NextResponse.json(
      {
        error: "Security scan failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/security/svg
 * Get information about SVG security scanning capabilities
 */
export async function GET() {
  return NextResponse.json({
    description: "SVG Security Scanner - Detects malicious code in SVG files",
    securityLevels: {
      [SvgSecurityLevel.PERMISSIVE]: {
        level: SvgSecurityLevel.PERMISSIVE,
        description: getSecurityLevelDescription(SvgSecurityLevel.PERMISSIVE),
        blocksScripts: true,
        allowsExternalReferences: true,
        allowsDataUris: true,
        allowsForeignObjects: true,
        allowsAnimations: true,
      },
      [SvgSecurityLevel.MODERATE]: {
        level: SvgSecurityLevel.MODERATE,
        description: getSecurityLevelDescription(SvgSecurityLevel.MODERATE),
        blocksScripts: true,
        allowsExternalReferences: false,
        allowsDataUris: false,
        allowsForeignObjects: false,
        allowsAnimations: true,
      },
      [SvgSecurityLevel.STRICT]: {
        level: SvgSecurityLevel.STRICT,
        description: getSecurityLevelDescription(SvgSecurityLevel.STRICT),
        blocksScripts: true,
        allowsExternalReferences: false,
        allowsDataUris: false,
        allowsForeignObjects: false,
        allowsAnimations: false,
      },
    },
    threatTypes: [
      {
        type: "script",
        description: "JavaScript or executable code",
        severity: "High (9-10)",
        alwaysBlocking: true,
      },
      {
        type: "event_handler",
        description: "HTML event handlers (onclick, onload, etc.)",
        severity: "High (9)",
        alwaysBlocking: true,
      },
      {
        type: "external_reference",
        description: "References to external resources",
        severity: "Medium (6-7)",
        blockingLevel: "moderate+",
      },
      {
        type: "data_uri",
        description: "Embedded data URIs",
        severity: "Medium (6-9)",
        blockingLevel: "moderate+",
      },
      {
        type: "foreign_object",
        description: "Foreign object elements (can embed HTML)",
        severity: "High (8)",
        blockingLevel: "moderate+",
      },
      {
        type: "animation",
        description: "SVG animation elements",
        severity: "Low (3)",
        blockingLevel: "strict",
      },
      {
        type: "xml_entity",
        description: "XML entity declarations",
        severity: "Medium (5)",
        blockingLevel: "strict",
      },
    ],
    limits: {
      maxFileSize: `${MAX_SVG_SIZE / 1024 / 1024}MB`,
      minFileSize: "100 bytes",
      supportedExtensions: [".svg"],
    },
    usage: {
      endpoint: "/api/security/svg",
      method: "POST",
      contentType: "multipart/form-data",
      parameters: {
        file: {
          type: "File",
          required: true,
          description: "SVG file to scan",
        },
        securityLevel: {
          type: "string",
          required: false,
          default: "moderate",
          options: Object.values(SvgSecurityLevel),
          description: "Security level for scanning",
        },
        sanitize: {
          type: "boolean",
          required: false,
          default: false,
          description: "Whether to attempt sanitization of threats",
        },
      },
    },
  });
}
