/**
 * Security Middleware
 *
 * Integrates all security layers:
 * - Device fingerprinting
 * - Resource quotas
 * - Behavioral analysis
 * - Progressive challenges
 * - Auto-blocking
 *
 * @module lib/security/middleware
 */

import type { NextRequest } from "next/server";
import { isBlocked, blockIdentifier, progressiveBlock } from "./blocker";
import { checkResourceQuota, recordResourceUsage } from "./resourceQuota";
import { analyzeUserRisk, recordUserBehavior } from "./behavioral";

/**
 * Security check result
 */
export interface SecurityCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Security status */
  status: "allowed" | "blocked" | "quota_exceeded" | "high_risk";
  /** Reason for denial (if not allowed) */
  reason?: string;
  /** Suggested HTTP status code */
  statusCode: 200 | 429 | 403;
  /** Response headers to include */
  headers?: Record<string, string>;
  /** Challenge required (for future CAPTCHA integration) */
  challengeRequired?: boolean;
  /** Risk assessment (for logging) */
  riskScore?: number;
  /** Retry after (seconds) */
  retryAfter?: number;
}

/**
 * Perform comprehensive security check
 *
 * @param identifier - Primary identifier (session ID)
 * @param request - Request object
 * @param requestData - Request-specific data
 * @returns Security check result
 */
export async function performSecurityCheck(
  identifier: string,
  request: NextRequest,
  requestData: {
    fileCount: number;
    fileSizeMB: number;
  }
): Promise<SecurityCheckResult> {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Step 1: Check if blocked
  console.log("[SECURITY] Checking block status", { identifier, ip });

  const blockInfo = await isBlocked(identifier);
  if (blockInfo) {
    console.warn("[SECURITY] Request from blocked identifier", {
      identifier,
      reason: blockInfo.reason,
      expiresAt: new Date(blockInfo.expiresAt).toISOString(),
    });

    return {
      allowed: false,
      status: "blocked",
      reason: `Access denied: ${blockInfo.reason}`,
      statusCode: 403,
      retryAfter: Math.ceil((blockInfo.expiresAt - Date.now()) / 1000),
      headers: {
        "X-Block-Reason": blockInfo.reason,
        "X-Block-Expires": new Date(blockInfo.expiresAt).toISOString(),
      },
    };
  }

  // Step 2: Behavioral analysis
  console.log("[SECURITY] Analyzing behavior", { identifier });

  await recordUserBehavior(identifier, {
    fileCount: requestData.fileCount,
    fileSizeMB: requestData.fileSizeMB,
    userAgent,
  });

  const riskAssessment = await analyzeUserRisk(identifier);

  console.log("[SECURITY] Risk assessment", {
    identifier,
    score: riskAssessment.score,
    level: riskAssessment.level,
    action: riskAssessment.action,
    confidence: riskAssessment.confidence,
  });

  // Step 3: Block if critical risk
  if (riskAssessment.action === "block") {
    console.warn("[SECURITY] Blocking high-risk user", {
      identifier,
      score: riskAssessment.score,
      factors: riskAssessment.factors,
    });

    // Progressive block (escalating duration)
    await progressiveBlock(identifier, `High risk score: ${riskAssessment.score}`);

    return {
      allowed: false,
      status: "high_risk",
      reason: "Suspicious activity detected",
      statusCode: 403,
      riskScore: riskAssessment.score,
      retryAfter: 3600, // 1 hour
      headers: {
        "X-Risk-Score": riskAssessment.score.toString(),
        "X-Risk-Level": riskAssessment.level,
      },
    };
  }

  // Step 4: Resource quota check
  console.log("[SECURITY] Checking resource quota", { identifier });

  const strictMode = riskAssessment.score > 50; // Strict limits for medium+ risk
  const quotaCheck = await checkResourceQuota(
    identifier,
    requestData.fileCount,
    requestData.fileSizeMB,
    strictMode
  );

  if (!quotaCheck.allowed) {
    console.warn("[SECURITY] Quota exceeded", {
      identifier,
      limit: quotaCheck.limitExceeded,
      usage: quotaCheck.usage,
    });

    return {
      allowed: false,
      status: "quota_exceeded",
      reason: quotaCheck.limitExceeded || "Resource quota exceeded",
      statusCode: 429,
      retryAfter: quotaCheck.retryAfter,
      headers: {
        "X-RateLimit-Limit": quotaCheck.limits.maxFilesPerDay.toString(),
        "X-RateLimit-Remaining": (
          quotaCheck.limits.maxFilesPerDay - quotaCheck.usage.filesProcessed
        ).toString(),
        "Retry-After": (quotaCheck.retryAfter || 3600).toString(),
      },
    };
  }

  // Step 5: Challenge if medium risk
  const challengeRequired = riskAssessment.action === "challenge";

  if (challengeRequired) {
    console.log("[SECURITY] Challenge recommended for medium risk user", {
      identifier,
      score: riskAssessment.score,
    });
  }

  // All checks passed
  return {
    allowed: true,
    status: "allowed",
    statusCode: 200,
    challengeRequired,
    riskScore: riskAssessment.score,
    headers: {
      "X-Risk-Score": riskAssessment.score.toString(),
      "X-Risk-Level": riskAssessment.level,
    },
  };
}

/**
 * Record successful request for quota tracking
 */
export async function recordSuccess(
  identifier: string,
  data: {
    fileCount: number;
    fileSizeMB: number;
    cpuTimeMs?: number;
  }
): Promise<void> {
  await recordResourceUsage(identifier, data.fileCount, data.fileSizeMB, data.cpuTimeMs);
}

/**
 * Check honeypot field submission
 */
export function checkHoneypot(formData: FormData): boolean {
  // Check for common honeypot field names
  const honeypotFields = ["email_confirm", "website", "url", "phone_number", "company"];

  for (const field of honeypotFields) {
    if (formData.has(field) && formData.get(field)) {
      console.warn("[SECURITY] Honeypot field filled", { field });
      return true; // Bot detected
    }
  }

  return false;
}

/**
 * Analyze request timing
 */
export function analyzeRequestTiming(startTime: number): { tooFast: boolean; duration: number } {
  const duration = Date.now() - startTime;

  // Requests faster than 500ms are suspicious (unless it's a cached response)
  const tooFast = duration < 500;

  return { tooFast, duration };
}
