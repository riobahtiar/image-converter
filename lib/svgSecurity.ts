/**
 * SVG Security Scanner
 *
 * Comprehensive security scanner for SVG files to detect malicious code, scripts,
 * external references, and other security threats commonly found in SVG files.
 *
 * @module lib/svgSecurity
 *
 * @example
 * import { scanSvgSecurity, SvgSecurityLevel } from '@/lib/svgSecurity';
 *
 * const result = await scanSvgSecurity(svgContent, SvgSecurityLevel.STRICT);
 * if (!result.safe) {
 *   console.error('SVG contains threats:', result.threats);
 *   return;
 * }
 */

/**
 * Security threat levels for SVG scanning
 */
export enum SvgSecurityLevel {
  /** Minimal security - only blocks obvious malicious content */
  PERMISSIVE = "permissive",
  /** Balanced security - blocks common threats while preserving functionality */
  MODERATE = "moderate",
  /** Maximum security - blocks all potentially dangerous content */
  STRICT = "strict",
}

/**
 * Types of security threats that can be found in SVG files
 */
export enum SvgThreatType {
  /** JavaScript code execution */
  SCRIPT = "script",
  /** External resource loading */
  EXTERNAL_REFERENCE = "external_reference",
  /** Data URI with executable content */
  DATA_URI = "data_uri",
  /** Event handlers (onclick, onload, etc.) */
  EVENT_HANDLER = "event_handler",
  /** Foreign objects that can embed HTML */
  FOREIGN_OBJECT = "foreign_object",
  /** Animation that could be used for attacks */
  ANIMATION = "animation",
  /** Embedded fonts or stylesheets */
  EMBEDDED_CONTENT = "embedded_content",
  /** Links to external resources */
  EXTERNAL_LINK = "external_link",
  /** Use of deprecated or dangerous elements */
  DEPRECATED_ELEMENT = "deprecated_element",
  /** XML processing instructions */
  PROCESSING_INSTRUCTION = "processing_instruction",
  /** Document type definitions */
  DOCTYPE = "doctype",
  /** XML entities that could be exploited */
  XML_ENTITY = "xml_entity",
}

/**
 * Security threat found in SVG
 */
export interface SvgThreat {
  /** Type of threat */
  type: SvgThreatType;
  /** Severity level (1-10, where 10 is most severe) */
  severity: number;
  /** Human-readable description */
  description: string;
  /** Location in the SVG content (line number if available) */
  location?: number;
  /** The specific content that triggered the threat */
  content?: string;
  /** Whether this threat should block the file */
  blocking: boolean;
}

/**
 * Result of SVG security scan
 */
export interface SvgSecurityResult {
  /** Whether the SVG is considered safe */
  safe: boolean;
  /** List of threats found */
  threats: SvgThreat[];
  /** Security level used for scanning */
  securityLevel: SvgSecurityLevel;
  /** Whether the content was sanitized */
  sanitized: boolean;
  /** Sanitized content (if sanitization was performed) */
  sanitizedContent?: string;
  /** File size of original content */
  originalSize: number;
  /** File size after sanitization (if applicable) */
  sanitizedSize?: number;
}

/**
 * Dangerous SVG elements and attributes by security level
 */
const SECURITY_RULES = {
  [SvgSecurityLevel.PERMISSIVE]: {
    blockedElements: ["script"],
    blockedAttributes: ["onload", "onclick", "onerror", "onmouseover"],
    allowExternalReferences: true,
    allowDataUris: true,
    allowForeignObjects: true,
    allowAnimations: true,
  },
  [SvgSecurityLevel.MODERATE]: {
    blockedElements: ["script", "foreignObject"],
    blockedAttributes: [
      "onload",
      "onclick",
      "onerror",
      "onmouseover",
      "onmouseout",
      "onmousedown",
      "onmouseup",
      "onkeydown",
      "onkeyup",
      "onkeypress",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit",
      "onreset",
    ],
    allowExternalReferences: false,
    allowDataUris: false,
    allowForeignObjects: false,
    allowAnimations: true,
  },
  [SvgSecurityLevel.STRICT]: {
    blockedElements: ["script", "foreignObject", "iframe", "embed", "object"],
    blockedAttributes: [
      // All event handlers
      "onload",
      "onclick",
      "onerror",
      "onmouseover",
      "onmouseout",
      "onmousedown",
      "onmouseup",
      "onmousemove",
      "onkeydown",
      "onkeyup",
      "onkeypress",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit",
      "onreset",
      "onscroll",
      "onresize",
      "onunload",
      "onbeforeunload",
      // Potentially dangerous attributes
      "href",
      "xlink:href",
      "src",
    ],
    allowExternalReferences: false,
    allowDataUris: false,
    allowForeignObjects: false,
    allowAnimations: false,
  },
};

/**
 * Regular expressions for detecting various threats
 */
const THREAT_PATTERNS = {
  // JavaScript in various forms
  javascript: [
    /javascript:/gi,
    /<script[\s\S]*?<\/script>/gi,
    /on\w+\s*=\s*['""][^'"]*['"]/gi,
    /expression\s*\(/gi,
    /eval\s*\(/gi,
  ],

  // External references
  externalRef: [
    /https?:\/\/[^\s"'>]+/gi,
    /ftp:\/\/[^\s"'>]+/gi,
    /file:\/\/[^\s"'>]+/gi,
    /@import\s+url\(/gi,
  ],

  // Data URIs
  dataUri: [
    /data:[^;]*;base64,/gi,
    /data:[^;]*;charset/gi,
    /data:text\/html/gi,
    /data:application\/javascript/gi,
  ],

  // XML entities and processing instructions
  xmlEntity: [/<!ENTITY[^>]*>/gi, /&[a-zA-Z][a-zA-Z0-9]*;/g],

  processingInstruction: [/<\?[^>]*\?>/g],

  // DOCTYPE declarations
  doctype: [/<!DOCTYPE[^>]*>/gi],
};

/**
 * Scan SVG content for security threats
 *
 * @param content - SVG file content as string
 * @param securityLevel - Security level to apply
 * @param options - Additional options
 * @returns Security scan result
 */
export async function scanSvgSecurity(
  content: string,
  securityLevel: SvgSecurityLevel = SvgSecurityLevel.MODERATE,
  options: {
    /** Whether to attempt sanitization */
    sanitize?: boolean;
    /** Maximum file size to process (default: 5MB) */
    maxSize?: number;
  } = {}
): Promise<SvgSecurityResult> {
  const { sanitize = false, maxSize = 5 * 1024 * 1024 } = options;
  const threats: SvgThreat[] = [];
  const originalSize = Buffer.byteLength(content, "utf8");

  // Check file size
  if (originalSize > maxSize) {
    threats.push({
      type: SvgThreatType.EXTERNAL_REFERENCE,
      severity: 8,
      description: `SVG file too large (${(originalSize / 1024 / 1024).toFixed(2)}MB). Maximum allowed: ${(maxSize / 1024 / 1024).toFixed(2)}MB`,
      blocking: true,
    });
  }

  const rules = SECURITY_RULES[securityLevel];

  // 1. Check for malicious elements
  const elementThreats = checkMaliciousElements(content, rules, securityLevel);
  threats.push(...elementThreats);

  // 2. Check for malicious attributes
  const attributeThreats = checkMaliciousAttributes(content, rules, securityLevel);
  threats.push(...attributeThreats);

  // 3. Check for JavaScript patterns
  const jsThreats = checkJavaScriptPatterns(content, securityLevel);
  threats.push(...jsThreats);

  // 4. Check for external references
  if (!rules.allowExternalReferences) {
    const externalThreats = checkExternalReferences(content, securityLevel);
    threats.push(...externalThreats);
  }

  // 5. Check for data URIs
  if (!rules.allowDataUris) {
    const dataUriThreats = checkDataUris(content, securityLevel);
    threats.push(...dataUriThreats);
  }

  // 6. Check for XML-specific threats
  const xmlThreats = checkXmlThreats(content, securityLevel);
  threats.push(...xmlThreats);

  // 7. Check for animation-based threats
  if (!rules.allowAnimations) {
    const animationThreats = checkAnimationThreats(content, securityLevel);
    threats.push(...animationThreats);
  }

  // Determine if file is safe
  const blockingThreats = threats.filter((t) => t.blocking);
  const safe = blockingThreats.length === 0;

  let result: SvgSecurityResult = {
    safe,
    threats,
    securityLevel,
    sanitized: false,
    originalSize,
  };

  // Attempt sanitization if requested and threats were found
  if (sanitize && !safe && threats.length > 0) {
    try {
      const sanitizedContent = sanitizeSvgContent(content, threats, rules);
      const sanitizedSize = Buffer.byteLength(sanitizedContent, "utf8");

      // Re-scan sanitized content to verify it's now safe
      const rescanResult = await scanSvgSecurity(sanitizedContent, securityLevel, {
        sanitize: false,
      });

      result = {
        ...result,
        safe: rescanResult.safe,
        sanitized: true,
        sanitizedContent,
        sanitizedSize,
        threats: [
          ...threats,
          ...rescanResult.threats.map((t) => ({
            ...t,
            description: `After sanitization: ${t.description}`,
          })),
        ],
      };
    } catch (error) {
      threats.push({
        type: SvgThreatType.EXTERNAL_REFERENCE,
        severity: 5,
        description: `Sanitization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        blocking: false,
      });
    }
  }

  return result;
}

/**
 * Check for malicious SVG elements
 */
function checkMaliciousElements(
  content: string,
  rules: any,
  securityLevel: SvgSecurityLevel
): SvgThreat[] {
  const threats: SvgThreat[] = [];

  for (const element of rules.blockedElements) {
    const regex = new RegExp(`<${element}[^>]*>`, "gi");
    const matches = content.match(regex);

    if (matches) {
      for (const match of matches) {
        threats.push({
          type:
            element === "script"
              ? SvgThreatType.SCRIPT
              : element === "foreignObject"
                ? SvgThreatType.FOREIGN_OBJECT
                : SvgThreatType.DEPRECATED_ELEMENT,
          severity: element === "script" ? 10 : 8,
          description: `Dangerous element detected: ${element}`,
          content: match,
          blocking: true,
        });
      }
    }
  }

  return threats;
}

/**
 * Check for malicious attributes
 */
function checkMaliciousAttributes(
  content: string,
  rules: any,
  securityLevel: SvgSecurityLevel
): SvgThreat[] {
  const threats: SvgThreat[] = [];

  for (const attr of rules.blockedAttributes) {
    const regex = new RegExp(`${attr}\\s*=\\s*["'][^"']*["']`, "gi");
    const matches = content.match(regex);

    if (matches) {
      for (const match of matches) {
        const isEventHandler = attr.startsWith("on");
        threats.push({
          type: isEventHandler ? SvgThreatType.EVENT_HANDLER : SvgThreatType.EXTERNAL_REFERENCE,
          severity: isEventHandler ? 9 : 6,
          description: `Dangerous attribute detected: ${attr}`,
          content: match,
          blocking: securityLevel === SvgSecurityLevel.STRICT || isEventHandler,
        });
      }
    }
  }

  return threats;
}

/**
 * Check for JavaScript patterns
 */
function checkJavaScriptPatterns(content: string, securityLevel: SvgSecurityLevel): SvgThreat[] {
  const threats: SvgThreat[] = [];

  for (const pattern of THREAT_PATTERNS.javascript) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        threats.push({
          type: SvgThreatType.SCRIPT,
          severity: 10,
          description: "JavaScript code detected in SVG",
          content: match.substring(0, 100) + (match.length > 100 ? "..." : ""),
          blocking: true,
        });
      }
    }
  }

  return threats;
}

/**
 * Check for external references
 */
function checkExternalReferences(content: string, securityLevel: SvgSecurityLevel): SvgThreat[] {
  const threats: SvgThreat[] = [];

  for (const pattern of THREAT_PATTERNS.externalRef) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        threats.push({
          type: SvgThreatType.EXTERNAL_REFERENCE,
          severity: 7,
          description: "External reference detected",
          content: match,
          blocking: securityLevel === SvgSecurityLevel.STRICT,
        });
      }
    }
  }

  return threats;
}

/**
 * Check for dangerous data URIs
 */
function checkDataUris(content: string, securityLevel: SvgSecurityLevel): SvgThreat[] {
  const threats: SvgThreat[] = [];

  for (const pattern of THREAT_PATTERNS.dataUri) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        const severity = match.includes("javascript") || match.includes("text/html") ? 9 : 6;
        threats.push({
          type: SvgThreatType.DATA_URI,
          severity,
          description: "Data URI detected",
          content: match.substring(0, 100) + (match.length > 100 ? "..." : ""),
          blocking: severity >= 8,
        });
      }
    }
  }

  return threats;
}

/**
 * Check for XML-specific threats
 */
function checkXmlThreats(content: string, securityLevel: SvgSecurityLevel): SvgThreat[] {
  const threats: SvgThreat[] = [];

  // Check for XML entities
  for (const pattern of THREAT_PATTERNS.xmlEntity) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        threats.push({
          type: SvgThreatType.XML_ENTITY,
          severity: 5,
          description: "XML entity detected",
          content: match,
          blocking: securityLevel === SvgSecurityLevel.STRICT,
        });
      }
    }
  }

  // Check for processing instructions
  for (const pattern of THREAT_PATTERNS.processingInstruction) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        threats.push({
          type: SvgThreatType.PROCESSING_INSTRUCTION,
          severity: 6,
          description: "XML processing instruction detected",
          content: match,
          blocking: securityLevel === SvgSecurityLevel.STRICT,
        });
      }
    }
  }

  // Check for DOCTYPE
  for (const pattern of THREAT_PATTERNS.doctype) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        threats.push({
          type: SvgThreatType.DOCTYPE,
          severity: 4,
          description: "DOCTYPE declaration detected",
          content: match,
          blocking: false,
        });
      }
    }
  }

  return threats;
}

/**
 * Check for animation-based threats
 */
function checkAnimationThreats(content: string, securityLevel: SvgSecurityLevel): SvgThreat[] {
  const threats: SvgThreat[] = [];

  const animationElements = ["animate", "animateTransform", "animateMotion", "set"];

  for (const element of animationElements) {
    const regex = new RegExp(`<${element}[^>]*>`, "gi");
    const matches = content.match(regex);

    if (matches) {
      for (const match of matches) {
        threats.push({
          type: SvgThreatType.ANIMATION,
          severity: 3,
          description: `Animation element detected: ${element}`,
          content: match,
          blocking: securityLevel === SvgSecurityLevel.STRICT,
        });
      }
    }
  }

  return threats;
}

/**
 * Sanitize SVG content by removing or neutralizing threats
 */
function sanitizeSvgContent(content: string, threats: SvgThreat[], rules: any): string {
  let sanitized = content;

  // Remove blocked elements entirely
  for (const element of rules.blockedElements) {
    const regex = new RegExp(`<${element}[^>]*>.*?</${element}>`, "gis");
    sanitized = sanitized.replace(regex, "");

    // Also remove self-closing versions
    const selfClosingRegex = new RegExp(`<${element}[^>]*/>`, "gi");
    sanitized = sanitized.replace(selfClosingRegex, "");
  }

  // Remove blocked attributes
  for (const attr of rules.blockedAttributes) {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, "gi");
    sanitized = sanitized.replace(regex, "");
  }

  // Remove JavaScript patterns
  for (const pattern of THREAT_PATTERNS.javascript) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Remove external references if not allowed
  if (!rules.allowExternalReferences) {
    for (const pattern of THREAT_PATTERNS.externalRef) {
      sanitized = sanitized.replace(pattern, "#");
    }
  }

  // Remove data URIs if not allowed
  if (!rules.allowDataUris) {
    for (const pattern of THREAT_PATTERNS.dataUri) {
      sanitized = sanitized.replace(pattern, "data:,");
    }
  }

  // Remove XML entities and processing instructions
  for (const pattern of THREAT_PATTERNS.xmlEntity) {
    sanitized = sanitized.replace(pattern, "");
  }

  for (const pattern of THREAT_PATTERNS.processingInstruction) {
    sanitized = sanitized.replace(pattern, "");
  }

  return sanitized;
}

/**
 * Get human-readable security level description
 */
export function getSecurityLevelDescription(level: SvgSecurityLevel): string {
  switch (level) {
    case SvgSecurityLevel.PERMISSIVE:
      return "Minimal security - allows most content except obvious threats";
    case SvgSecurityLevel.MODERATE:
      return "Balanced security - blocks common threats while preserving functionality";
    case SvgSecurityLevel.STRICT:
      return "Maximum security - blocks all potentially dangerous content";
    default:
      return "Unknown security level";
  }
}

/**
 * Get threat type description
 */
export function getThreatTypeDescription(type: SvgThreatType): string {
  switch (type) {
    case SvgThreatType.SCRIPT:
      return "JavaScript or executable code";
    case SvgThreatType.EXTERNAL_REFERENCE:
      return "Reference to external resources";
    case SvgThreatType.DATA_URI:
      return "Embedded data URI";
    case SvgThreatType.EVENT_HANDLER:
      return "HTML event handler";
    case SvgThreatType.FOREIGN_OBJECT:
      return "Foreign object element";
    case SvgThreatType.ANIMATION:
      return "SVG animation element";
    case SvgThreatType.EMBEDDED_CONTENT:
      return "Embedded font or stylesheet";
    case SvgThreatType.EXTERNAL_LINK:
      return "Link to external resource";
    case SvgThreatType.DEPRECATED_ELEMENT:
      return "Deprecated or dangerous element";
    case SvgThreatType.PROCESSING_INSTRUCTION:
      return "XML processing instruction";
    case SvgThreatType.DOCTYPE:
      return "Document type definition";
    case SvgThreatType.XML_ENTITY:
      return "XML entity declaration";
    default:
      return "Unknown threat type";
  }
}

/**
 * Generate security report for SVG scan result
 */
export function generateSecurityReport(result: SvgSecurityResult): string {
  const lines: string[] = [];

  lines.push(`SVG Security Scan Report`);
  lines.push(`========================`);
  lines.push(`Security Level: ${result.securityLevel.toUpperCase()}`);
  lines.push(`File Size: ${(result.originalSize / 1024).toFixed(2)} KB`);
  lines.push(`Status: ${result.safe ? "✅ SAFE" : "❌ UNSAFE"}`);
  lines.push(`Threats Found: ${result.threats.length}`);

  if (result.sanitized) {
    lines.push(`Sanitized: Yes (${((result.sanitizedSize || 0) / 1024).toFixed(2)} KB)`);
  }

  lines.push("");

  if (result.threats.length > 0) {
    lines.push("Threats Detected:");
    lines.push("-----------------");

    const blockingThreats = result.threats.filter((t) => t.blocking);
    const nonBlockingThreats = result.threats.filter((t) => !t.blocking);

    if (blockingThreats.length > 0) {
      lines.push("\n🚨 BLOCKING THREATS:");
      for (const threat of blockingThreats) {
        lines.push(`  • ${threat.description} (Severity: ${threat.severity}/10)`);
        if (threat.content) {
          lines.push(
            `    Content: ${threat.content.substring(0, 80)}${threat.content.length > 80 ? "..." : ""}`
          );
        }
      }
    }

    if (nonBlockingThreats.length > 0) {
      lines.push("\n⚠️  NON-BLOCKING THREATS:");
      for (const threat of nonBlockingThreats) {
        lines.push(`  • ${threat.description} (Severity: ${threat.severity}/10)`);
      }
    }
  } else {
    lines.push("No threats detected.");
  }

  return lines.join("\n");
}
