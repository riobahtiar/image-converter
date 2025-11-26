import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * File Cache Manager
 * Manages temporary file storage with automatic cleanup after 15 minutes
 * Used for uploaded files and conversion results
 *
 * @class FileCache
 */
export class FileCache {
  private cacheDir: string;
  private maxAge: number; // in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Create a FileCache instance
   * @param cacheDir - Directory for cache storage (default: ./public/uploads/temp)
   * @param maxAgeMinutes - Maximum age of cached files in minutes (default: 15)
   */
  constructor(cacheDir = "./public/uploads/temp", maxAgeMinutes = 15) {
    this.cacheDir = cacheDir;
    this.maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
    this.init();
  }

  /**
   * Initialize cache directory and start cleanup interval
   * @private
   */
  private async init(): Promise<void> {
    try {
      await mkdir(this.cacheDir, { recursive: true });

      // Start automatic cleanup every 5 minutes
      this.cleanupInterval = setInterval(
        () => {
          this.cleanup();
        },
        5 * 60 * 1000
      );
    } catch (error) {
      console.error("Failed to initialize cache:", error);
    }
  }

  /**
   * Clean up expired files from cache
   * Removes files older than maxAge
   * @returns Promise<number> - Number of files deleted
   */
  async cleanup(): Promise<number> {
    try {
      const files = await readdir(this.cacheDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const entry of files) {
        const entryPath = join(this.cacheDir, entry);

        try {
          const stats = await stat(entryPath);

          if (stats.isDirectory()) {
            // It's a session directory, check its files
            const sessionFiles = await readdir(entryPath);
            if (sessionFiles.length === 0) {
              // Empty session dir, remove it if old enough (or just remove it)
              if (now - stats.mtimeMs > this.maxAge) {
                await require("node:fs/promises").rmdir(entryPath);
              }
              continue;
            }

            for (const file of sessionFiles) {
              const filePath = join(entryPath, file);
              try {
                const fileStats = await stat(filePath);
                if (now - fileStats.mtimeMs > this.maxAge) {
                  await require("node:fs/promises").rm(filePath, { recursive: true, force: true });
                  deletedCount++;
                }
              } catch { }
            }
          } else {
            // Legacy flat file (or unexpected file in root)
            if (now - stats.mtimeMs > this.maxAge) {
              await require("node:fs/promises").rm(entryPath, { recursive: true, force: true });
              deletedCount++;
            }
          }
        } catch (_error) {
          // Ignore errors for individual files
        }
      }

      if (deletedCount > 0) {
        console.log(`[Cache] Cleaned up ${deletedCount} expired file(s)`);
      }

      return deletedCount;
    } catch (error) {
      console.error("[Cache] Cleanup failed:", error);
      return 0;
    }
  }

  /**
   * Get cache directory path
   * @returns Cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Get full path for a file in cache
   * @param filename - Filename
   * @returns Full path to file in cache
   */
  getFilePath(filename: string): string {
    return join(this.cacheDir, filename);
  }

  /**
   * Get session directory path
   * @param sessionId - Session ID
   * @returns Session directory path
   */
  getSessionDir(sessionId: string): string {
    return join(this.cacheDir, sessionId);
  }

  /**
   * Ensure session directory exists
   * @param sessionId - Session ID
   */
  async ensureSessionDir(sessionId: string): Promise<string> {
    const dir = this.getSessionDir(sessionId);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * Clear all files for a session
   * @param sessionId - Session ID
   */
  async clearSession(sessionId: string): Promise<void> {
    const dir = this.getSessionDir(sessionId);
    try {
      await require("node:fs/promises").rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.error(`[Cache] Failed to clear session ${sessionId}:`, error);
    }
  }

  /**
   * Check if a file exists in cache (session aware)
   * @param filename - Filename to check
   * @param sessionId - Optional session ID (if not provided, looks in root - legacy)
   * @returns Promise<boolean> - True if file exists
   */
  async fileExists(filename: string, sessionId?: string): Promise<boolean> {
    try {
      const filePath = sessionId
        ? join(this.getSessionDir(sessionId), filename)
        : this.getFilePath(filename);
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file age in milliseconds
   * @param filename - Filename to check
   * @param sessionId - Optional session ID
   * @returns Promise<number> - Age in milliseconds, or -1 if file doesn't exist
   */
  async getFileAge(filename: string, sessionId?: string): Promise<number> {
    try {
      const filePath = sessionId
        ? join(this.getSessionDir(sessionId), filename)
        : this.getFilePath(filename);
      const stats = await stat(filePath);
      return Date.now() - stats.mtimeMs;
    } catch {
      return -1;
    }
  }

  /**
   * Stop automatic cleanup
   * Call this when shutting down the application
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get cache statistics
   * @returns Promise<{fileCount: number, totalSize: number}>
   */
  async getStats(): Promise<{ fileCount: number; totalSize: number }> {
    try {
      const files = await readdir(this.cacheDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = join(this.cacheDir, file);
        try {
          const stats = await stat(filePath);
          totalSize += stats.size;
        } catch {
          // Ignore errors for individual files
        }
      }

      return {
        fileCount: files.length,
        totalSize,
      };
    } catch {
      return {
        fileCount: 0,
        totalSize: 0,
      };
    }
  }
}

// Singleton instance for the application
export const fileCache = new FileCache();
