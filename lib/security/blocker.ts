/**
 * Auto-Blocking System
 *
 * Temporarily blocks users who exhibit malicious behavior.
 * Supports multiple identifiers (session, IP, fingerprint) and blocking reasons.
 *
 * @module lib/security/blocker
 */

import { redis } from "../redis/adapter";

/**
 * Block information
 */
export interface BlockInfo {
  /** Identifier that was blocked */
  identifier: string;
  /** Reason for block */
  reason: string;
  /** Timestamp when blocked */
  blockedAt: number;
  /** Timestamp when block expires */
  expiresAt: number;
  /** Duration in seconds */
  duration: number;
  /** Number of times this identifier has been blocked */
  blockCount: number;
}

/**
 * Check if an identifier is blocked
 */
export async function isBlocked(identifier: string): Promise<BlockInfo | null> {
  const key = `block:${identifier}`;
  const data = await redis.get(key);

  if (!data) {
    return null;
  }

  const blockInfo: BlockInfo = JSON.parse(data);

  // Check if block has expired
  if (Date.now() > blockInfo.expiresAt) {
    await redis.del(key);
    return null;
  }

  return blockInfo;
}

/**
 * Block an identifier
 */
export async function blockIdentifier(
  identifier: string,
  reason: string,
  durationSeconds: number
): Promise<BlockInfo> {
  const key = `block:${identifier}`;
  const historyKey = `block:history:${identifier}`;

  // Get block history
  const historyData = await redis.get(historyKey);
  const blockCount = historyData ? Number.parseInt(historyData, 10) + 1 : 1;

  const now = Date.now();
  const blockInfo: BlockInfo = {
    identifier,
    reason,
    blockedAt: now,
    expiresAt: now + durationSeconds * 1000,
    duration: durationSeconds,
    blockCount,
  };

  // Save block info
  await redis.set(key, JSON.stringify(blockInfo));
  await redis.expire(key, durationSeconds);

  // Update history
  await redis.set(historyKey, blockCount.toString());
  await redis.expire(historyKey, 30 * 24 * 60 * 60); // Keep history for 30 days

  console.log("[BLOCKER] Identifier blocked", {
    identifier,
    reason,
    duration: `${durationSeconds}s`,
    blockCount,
  });

  return blockInfo;
}

/**
 * Unblock an identifier (for admin/testing)
 */
export async function unblockIdentifier(identifier: string): Promise<boolean> {
  const key = `block:${identifier}`;
  const deleted = await redis.del(key);
  return deleted > 0;
}

/**
 * Get block history count
 */
export async function getBlockCount(identifier: string): Promise<number> {
  const historyKey = `block:history:${identifier}`;
  const data = await redis.get(historyKey);
  return data ? Number.parseInt(data, 10) : 0;
}

/**
 * Check multiple identifiers (session, IP, fingerprint)
 */
export async function isAnyBlocked(identifiers: string[]): Promise<BlockInfo | null> {
  for (const identifier of identifiers) {
    const blockInfo = await isBlocked(identifier);
    if (blockInfo) {
      return blockInfo;
    }
  }
  return null;
}

/**
 * Block multiple identifiers at once
 */
export async function blockMultiple(
  identifiers: string[],
  reason: string,
  durationSeconds: number
): Promise<BlockInfo[]> {
  const results: BlockInfo[] = [];

  for (const identifier of identifiers) {
    const blockInfo = await blockIdentifier(identifier, reason, durationSeconds);
    results.push(blockInfo);
  }

  return results;
}

/**
 * Progressive blocking - increases duration with repeated offenses
 */
export async function progressiveBlock(identifier: string, reason: string): Promise<BlockInfo> {
  const blockCount = await getBlockCount(identifier);

  // Progressive durations:
  // 1st offense: 1 hour
  // 2nd offense: 6 hours
  // 3rd offense: 24 hours
  // 4th+ offense: 7 days

  let duration: number;
  if (blockCount === 0) {
    duration = 60 * 60; // 1 hour
  } else if (blockCount === 1) {
    duration = 6 * 60 * 60; // 6 hours
  } else if (blockCount === 2) {
    duration = 24 * 60 * 60; // 24 hours
  } else {
    duration = 7 * 24 * 60 * 60; // 7 days
  }

  return blockIdentifier(identifier, reason, duration);
}
