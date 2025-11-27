/**
 * Behavioral Analysis Engine
 *
 * Analyzes user behavior patterns to detect bots and malicious activity.
 * Assigns risk scores (0-100) based on multiple signals.
 *
 * @module lib/security/behavioral
 */

import { redis } from "../redis/adapter";

/**
 * Behavioral data tracked for each user
 */
export interface BehavioralData {
  /** Session identifier */
  identifier: string;
  /** Request timestamps */
  requestTimes: number[];
  /** File upload sizes (in MB) */
  uploadSizes: number[];
  /** File counts per request */
  fileCounts: number[];
  /** User agents seen */
  userAgents: Set<string>;
  /** Suspicious patterns detected */
  suspiciousPatterns: string[];
  /** First seen timestamp */
  firstSeen: number;
  /** Last seen timestamp */
  lastSeen: number;
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  /** Overall risk score (0-100) */
  score: number;
  /** Risk level */
  level: "low" | "medium" | "high" | "critical";
  /** Contributing factors */
  factors: {
    name: string;
    score: number;
    description: string;
  }[];
  /** Recommended action */
  action: "allow" | "challenge" | "block";
  /** Confidence in assessment (0-100) */
  confidence: number;
}

/**
 * Behavioral Analysis Manager
 */
export class BehavioralAnalyzer {
  private keyPrefix = "behavior";

  /**
   * Get Redis key for identifier
   */
  private getKey(identifier: string): string {
    return `${this.keyPrefix}:${identifier}`;
  }

  /**
   * Get behavioral data
   */
  async getBehavioralData(identifier: string): Promise<BehavioralData> {
    const key = this.getKey(identifier);
    const data = await redis.get(key);

    if (!data) {
      return {
        identifier,
        requestTimes: [],
        uploadSizes: [],
        fileCounts: [],
        userAgents: new Set(),
        suspiciousPatterns: [],
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      };
    }

    const parsed = JSON.parse(data);
    // Convert userAgents array back to Set
    parsed.userAgents = new Set(parsed.userAgents || []);
    return parsed;
  }

  /**
   * Record request
   */
  async recordRequest(
    identifier: string,
    data: {
      fileCount?: number;
      fileSizeMB?: number;
      userAgent?: string;
    }
  ): Promise<void> {
    const current = await this.getBehavioralData(identifier);
    const now = Date.now();

    // Update data
    current.requestTimes.push(now);
    if (data.fileCount) current.fileCounts.push(data.fileCount);
    if (data.fileSizeMB) current.uploadSizes.push(data.fileSizeMB);
    if (data.userAgent) current.userAgents.add(data.userAgent);
    current.lastSeen = now;

    // Keep only last 100 requests
    if (current.requestTimes.length > 100) {
      current.requestTimes = current.requestTimes.slice(-100);
    }
    if (current.uploadSizes.length > 100) {
      current.uploadSizes = current.uploadSizes.slice(-100);
    }
    if (current.fileCounts.length > 100) {
      current.fileCounts = current.fileCounts.slice(-100);
    }

    // Save
    const key = this.getKey(identifier);
    const toSave = {
      ...current,
      userAgents: Array.from(current.userAgents), // Convert Set to Array for JSON
    };

    await redis.set(key, JSON.stringify(toSave));
    await redis.expire(key, 7 * 24 * 60 * 60); // Keep for 7 days
  }

  /**
   * Analyze behavior and calculate risk score
   */
  async analyzeRisk(identifier: string): Promise<RiskAssessment> {
    const data = await this.getBehavioralData(identifier);
    const factors: RiskAssessment["factors"] = [];

    let totalScore = 0;
    let totalWeight = 0;

    // Factor 1: Request frequency (30% weight)
    const frequencyScore = this.analyzeRequestFrequency(data);
    factors.push({
      name: "Request Frequency",
      score: frequencyScore,
      description: this.getFrequencyDescription(frequencyScore),
    });
    totalScore += frequencyScore * 0.3;
    totalWeight += 0.3;

    // Factor 2: Upload patterns (25% weight)
    const uploadScore = this.analyzeUploadPatterns(data);
    factors.push({
      name: "Upload Patterns",
      score: uploadScore,
      description: this.getUploadDescription(uploadScore),
    });
    totalScore += uploadScore * 0.25;
    totalWeight += 0.25;

    // Factor 3: User agent consistency (15% weight)
    const uaScore = this.analyzeUserAgents(data);
    factors.push({
      name: "User Agent",
      score: uaScore,
      description: this.getUADescription(uaScore),
    });
    totalScore += uaScore * 0.15;
    totalWeight += 0.15;

    // Factor 4: Timing patterns (20% weight)
    const timingScore = this.analyzeTimingPatterns(data);
    factors.push({
      name: "Timing Patterns",
      score: timingScore,
      description: this.getTimingDescription(timingScore),
    });
    totalScore += timingScore * 0.2;
    totalWeight += 0.2;

    // Factor 5: Account age (10% weight)
    const ageScore = this.analyzeAccountAge(data);
    factors.push({
      name: "Account Age",
      score: ageScore,
      description: this.getAgeDescription(ageScore),
    });
    totalScore += ageScore * 0.1;
    totalWeight += 0.1;

    // Calculate final score
    const score = Math.round(totalScore / totalWeight);

    // Determine level and action
    let level: RiskAssessment["level"];
    let action: RiskAssessment["action"];

    if (score < 30) {
      level = "low";
      action = "allow";
    } else if (score < 60) {
      level = "medium";
      action = "challenge";
    } else if (score < 85) {
      level = "high";
      action = "challenge";
    } else {
      level = "critical";
      action = "block";
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(data);

    return {
      score,
      level,
      factors,
      action,
      confidence,
    };
  }

  /**
   * Analyze request frequency
   */
  private analyzeRequestFrequency(data: BehavioralData): number {
    if (data.requestTimes.length < 2) return 0;

    const now = Date.now();
    const recentRequests = data.requestTimes.filter((t) => now - t < 5 * 60 * 1000); // Last 5 minutes

    // More than 10 requests in 5 minutes = suspicious
    if (recentRequests.length > 10) return 90;
    if (recentRequests.length > 5) return 60;
    if (recentRequests.length > 3) return 30;

    return 0;
  }

  /**
   * Analyze upload patterns
   */
  private analyzeUploadPatterns(data: BehavioralData): number {
    if (data.uploadSizes.length === 0) return 0;

    // Check for identical file sizes (likely dummy files)
    const uniqueSizes = new Set(data.uploadSizes.map((s) => s.toFixed(2)));
    const uniqueRatio = uniqueSizes.size / data.uploadSizes.length;

    if (uniqueRatio < 0.3) return 85; // 70%+ identical sizes
    if (uniqueRatio < 0.5) return 60; // 50%+ identical sizes
    if (uniqueRatio < 0.7) return 30; // 30%+ identical sizes

    // Check for suspiciously consistent file counts
    const avgFileCount = data.fileCounts.reduce((a, b) => a + b, 0) / data.fileCounts.length;
    const allSameCount = data.fileCounts.every((c) => c === data.fileCounts[0]);

    if (allSameCount && avgFileCount > 5) return 70; // Always same number of files

    return 0;
  }

  /**
   * Analyze user agents
   */
  private analyzeUserAgents(data: BehavioralData): number {
    if (data.userAgents.size === 0) return 0;

    // Multiple user agents = suspicious
    if (data.userAgents.size > 3) return 75;
    if (data.userAgents.size > 1) return 40;

    // Check for bot-like user agents
    const userAgentStr = Array.from(data.userAgents).join(" ").toLowerCase();

    if (
      userAgentStr.includes("bot") ||
      userAgentStr.includes("crawler") ||
      userAgentStr.includes("spider") ||
      userAgentStr.includes("scraper")
    ) {
      return 95;
    }

    // Headless browsers
    if (userAgentStr.includes("headless") || userAgentStr.includes("phantom")) {
      return 90;
    }

    // Automation tools
    if (
      userAgentStr.includes("selenium") ||
      userAgentStr.includes("puppeteer") ||
      userAgentStr.includes("playwright")
    ) {
      return 85;
    }

    return 0;
  }

  /**
   * Analyze timing patterns
   */
  private analyzeTimingPatterns(data: BehavioralData): number {
    if (data.requestTimes.length < 3) return 0;

    // Calculate intervals between requests
    const intervals: number[] = [];
    for (let i = 1; i < data.requestTimes.length; i++) {
      intervals.push(data.requestTimes[i] - data.requestTimes[i - 1]);
    }

    // Check for suspiciously regular intervals (bot-like)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;

    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgInterval;

    // Very low variation = bot-like behavior
    if (coefficientOfVariation < 0.1) return 80; // Almost identical intervals
    if (coefficientOfVariation < 0.3) return 50; // Very regular
    if (coefficientOfVariation < 0.5) return 20; // Somewhat regular

    // Check for impossibly fast requests (< 1 second)
    const fastRequests = intervals.filter((i) => i < 1000);
    if (fastRequests.length > intervals.length * 0.5) return 90; // 50%+ too fast

    return 0;
  }

  /**
   * Analyze account age
   */
  private analyzeAccountAge(data: BehavioralData): number {
    const ageMs = Date.now() - data.firstSeen;
    const ageMinutes = ageMs / (60 * 1000);

    // Brand new accounts are more suspicious
    if (ageMinutes < 1) return 60; // Less than 1 minute old
    if (ageMinutes < 5) return 40; // Less than 5 minutes old
    if (ageMinutes < 30) return 20; // Less than 30 minutes old

    return 0;
  }

  /**
   * Calculate confidence in assessment
   */
  private calculateConfidence(data: BehavioralData): number {
    // More data = higher confidence
    const dataPoints = data.requestTimes.length + data.uploadSizes.length + data.fileCounts.length;

    if (dataPoints > 20) return 95;
    if (dataPoints > 10) return 80;
    if (dataPoints > 5) return 60;
    if (dataPoints > 2) return 40;

    return 20;
  }

  // Description helpers
  private getFrequencyDescription(score: number): string {
    if (score > 80) return "Excessive request rate detected";
    if (score > 50) return "High request frequency";
    if (score > 20) return "Moderate request frequency";
    return "Normal request frequency";
  }

  private getUploadDescription(score: number): string {
    if (score > 80) return "Suspicious upload patterns (likely dummy files)";
    if (score > 50) return "Unusual upload consistency";
    if (score > 20) return "Slightly repetitive uploads";
    return "Normal upload patterns";
  }

  private getUADescription(score: number): string {
    if (score > 80) return "Bot or automation tool detected";
    if (score > 50) return "Multiple user agents detected";
    if (score > 20) return "User agent changes detected";
    return "Consistent user agent";
  }

  private getTimingDescription(score: number): string {
    if (score > 80) return "Bot-like timing patterns";
    if (score > 50) return "Very regular request intervals";
    if (score > 20) return "Somewhat regular patterns";
    return "Human-like timing patterns";
  }

  private getAgeDescription(score: number): string {
    if (score > 50) return "Very new account";
    if (score > 30) return "New account";
    if (score > 10) return "Recent account";
    return "Established account";
  }
}

// Singleton instance
export const behavioralAnalyzer = new BehavioralAnalyzer();

/**
 * Convenience function to analyze risk
 */
export async function analyzeUserRisk(identifier: string): Promise<RiskAssessment> {
  return behavioralAnalyzer.analyzeRisk(identifier);
}

/**
 * Convenience function to record request
 */
export async function recordUserBehavior(
  identifier: string,
  data: {
    fileCount?: number;
    fileSizeMB?: number;
    userAgent?: string;
  }
): Promise<void> {
  return behavioralAnalyzer.recordRequest(identifier, data);
}
