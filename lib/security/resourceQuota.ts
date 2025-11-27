/**
 * Resource Quota System
 *
 * Tracks and enforces resource usage limits per user/session/fingerprint.
 * Prevents abuse through bulk uploads, CPU exhaustion, and storage attacks.
 *
 * @module lib/security/resourceQuota
 */

import { redis } from "../redis/adapter";

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  /** Number of files processed */
  filesProcessed: number;
  /** Total MB processed */
  totalMBProcessed: number;
  /** Total CPU time in milliseconds */
  cpuTimeMs: number;
  /** Number of requests */
  requestCount: number;
  /** Timestamp of first request in current window */
  windowStart: number;
  /** Last request timestamp */
  lastRequest: number;
}

/**
 * Resource quota limits
 */
export interface ResourceLimits {
  /** Max files per day */
  maxFilesPerDay: number;
  /** Max MB per day */
  maxMBPerDay: number;
  /** Max CPU time per day (milliseconds) */
  maxCpuTimePerDay: number;
  /** Max requests per hour */
  maxRequestsPerHour: number;
  /** Max files per single request */
  maxFilesPerRequest: number;
  /** Max MB per single request */
  maxMBPerRequest: number;
}

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current usage */
  usage: ResourceUsage;
  /** Applied limits */
  limits: ResourceLimits;
  /** Which limit was exceeded (if any) */
  limitExceeded?: string;
  /** Suggested wait time in seconds */
  retryAfter?: number;
}

/**
 * Default resource limits (generous for legitimate users)
 */
const DEFAULT_LIMITS: ResourceLimits = {
  maxFilesPerDay: 100,
  maxMBPerDay: 500,
  maxCpuTimePerDay: 300000, // 5 minutes
  maxRequestsPerHour: 50,
  maxFilesPerRequest: 20,
  maxMBPerRequest: 100,
};

/**
 * Strict limits for suspicious users
 */
const STRICT_LIMITS: ResourceLimits = {
  maxFilesPerDay: 20,
  maxMBPerDay: 50,
  maxCpuTimePerDay: 60000, // 1 minute
  maxRequestsPerHour: 10,
  maxFilesPerRequest: 5,
  maxMBPerRequest: 20,
};

/**
 * Resource Quota Manager
 */
export class ResourceQuotaManager {
  private keyPrefix = "quota";

  /**
   * Get Redis key for identifier
   */
  private getKey(identifier: string, period: "day" | "hour" = "day"): string {
    return `${this.keyPrefix}:${period}:${identifier}`;
  }

  /**
   * Get current resource usage
   */
  async getUsage(identifier: string): Promise<ResourceUsage> {
    const dayKey = this.getKey(identifier, "day");
    const hourKey = this.getKey(identifier, "hour");

    const [dayData, hourData] = await Promise.all([redis.get(dayKey), redis.get(hourKey)]);

    const dayUsage: ResourceUsage = dayData
      ? JSON.parse(dayData)
      : {
          filesProcessed: 0,
          totalMBProcessed: 0,
          cpuTimeMs: 0,
          requestCount: 0,
          windowStart: Date.now(),
          lastRequest: Date.now(),
        };

    const hourUsage: ResourceUsage = hourData ? JSON.parse(hourData) : dayUsage;

    // Return combined usage (use hour data for request count, day data for everything else)
    return {
      ...dayUsage,
      requestCount: hourUsage.requestCount,
    };
  }

  /**
   * Check if request is within quota
   */
  async checkQuota(
    identifier: string,
    requestData: {
      fileCount: number;
      fileSizeMB: number;
    },
    strictMode = false
  ): Promise<QuotaCheckResult> {
    const usage = await this.getUsage(identifier);
    const limits = strictMode ? STRICT_LIMITS : DEFAULT_LIMITS;

    // Check per-request limits
    if (requestData.fileCount > limits.maxFilesPerRequest) {
      return {
        allowed: false,
        usage,
        limits,
        limitExceeded: `Files per request limit exceeded (${requestData.fileCount} > ${limits.maxFilesPerRequest})`,
        retryAfter: 60,
      };
    }

    if (requestData.fileSizeMB > limits.maxMBPerRequest) {
      return {
        allowed: false,
        usage,
        limits,
        limitExceeded: `Size per request limit exceeded (${requestData.fileSizeMB.toFixed(2)}MB > ${limits.maxMBPerRequest}MB)`,
        retryAfter: 60,
      };
    }

    // Check daily limits
    if (usage.filesProcessed + requestData.fileCount > limits.maxFilesPerDay) {
      const resetTime = usage.windowStart + 24 * 60 * 60 * 1000;
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

      return {
        allowed: false,
        usage,
        limits,
        limitExceeded: `Daily file limit exceeded (${usage.filesProcessed + requestData.fileCount} > ${limits.maxFilesPerDay})`,
        retryAfter,
      };
    }

    if (usage.totalMBProcessed + requestData.fileSizeMB > limits.maxMBPerDay) {
      const resetTime = usage.windowStart + 24 * 60 * 60 * 1000;
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

      return {
        allowed: false,
        usage,
        limits,
        limitExceeded: `Daily size limit exceeded (${(usage.totalMBProcessed + requestData.fileSizeMB).toFixed(2)}MB > ${limits.maxMBPerDay}MB)`,
        retryAfter,
      };
    }

    // Check hourly request limit
    if (usage.requestCount >= limits.maxRequestsPerHour) {
      return {
        allowed: false,
        usage,
        limits,
        limitExceeded: `Hourly request limit exceeded (${usage.requestCount} > ${limits.maxRequestsPerHour})`,
        retryAfter: 3600,
      };
    }

    return {
      allowed: true,
      usage,
      limits,
    };
  }

  /**
   * Record resource usage
   */
  async recordUsage(
    identifier: string,
    usage: {
      fileCount: number;
      fileSizeMB: number;
      cpuTimeMs?: number;
    }
  ): Promise<void> {
    const dayKey = this.getKey(identifier, "day");
    const hourKey = this.getKey(identifier, "hour");

    const now = Date.now();

    // Get current usage
    const current = await this.getUsage(identifier);

    // Check if we need to reset windows
    const dayAge = now - current.windowStart;
    const hourAge = now - current.lastRequest;

    let dayUsage: ResourceUsage;
    if (dayAge > 24 * 60 * 60 * 1000) {
      // Reset daily window
      dayUsage = {
        filesProcessed: usage.fileCount,
        totalMBProcessed: usage.fileSizeMB,
        cpuTimeMs: usage.cpuTimeMs || 0,
        requestCount: 1,
        windowStart: now,
        lastRequest: now,
      };
    } else {
      // Increment daily usage
      dayUsage = {
        filesProcessed: current.filesProcessed + usage.fileCount,
        totalMBProcessed: current.totalMBProcessed + usage.fileSizeMB,
        cpuTimeMs: current.cpuTimeMs + (usage.cpuTimeMs || 0),
        requestCount: current.requestCount + 1,
        windowStart: current.windowStart,
        lastRequest: now,
      };
    }

    // Hour usage (for request count only)
    let hourUsage: ResourceUsage;
    if (hourAge > 60 * 60 * 1000) {
      // Reset hourly window
      hourUsage = {
        ...dayUsage,
        requestCount: 1,
        windowStart: now,
      };
    } else {
      // Get hour data
      const hourData = await redis.get(hourKey);
      const currentHour: ResourceUsage = hourData ? JSON.parse(hourData) : current;

      hourUsage = {
        ...dayUsage,
        requestCount: currentHour.requestCount + 1,
      };
    }

    // Save to Redis
    await Promise.all([
      redis.set(dayKey, JSON.stringify(dayUsage)),
      redis.set(hourKey, JSON.stringify(hourUsage)),
      redis.expire(dayKey, 24 * 60 * 60), // 24 hours
      redis.expire(hourKey, 60 * 60), // 1 hour
    ]);
  }

  /**
   * Reset quota for an identifier
   */
  async resetQuota(identifier: string): Promise<void> {
    const dayKey = this.getKey(identifier, "day");
    const hourKey = this.getKey(identifier, "hour");

    await redis.del(dayKey, hourKey);
  }

  /**
   * Get quota status (for debugging/admin)
   */
  async getQuotaStatus(identifier: string): Promise<{
    usage: ResourceUsage;
    limits: ResourceLimits;
    percentUsed: {
      files: number;
      mb: number;
      requests: number;
    };
  }> {
    const usage = await this.getUsage(identifier);
    const limits = DEFAULT_LIMITS;

    return {
      usage,
      limits,
      percentUsed: {
        files: Math.round((usage.filesProcessed / limits.maxFilesPerDay) * 100),
        mb: Math.round((usage.totalMBProcessed / limits.maxMBPerDay) * 100),
        requests: Math.round((usage.requestCount / limits.maxRequestsPerHour) * 100),
      },
    };
  }
}

// Singleton instance
export const resourceQuota = new ResourceQuotaManager();

/**
 * Convenience function to check quota
 */
export async function checkResourceQuota(
  identifier: string,
  fileCount: number,
  fileSizeMB: number,
  strictMode = false
): Promise<QuotaCheckResult> {
  return resourceQuota.checkQuota(
    identifier,
    {
      fileCount,
      fileSizeMB,
    },
    strictMode
  );
}

/**
 * Convenience function to record usage
 */
export async function recordResourceUsage(
  identifier: string,
  fileCount: number,
  fileSizeMB: number,
  cpuTimeMs = 0
): Promise<void> {
  return resourceQuota.recordUsage(identifier, {
    fileCount,
    fileSizeMB,
    cpuTimeMs,
  });
}
