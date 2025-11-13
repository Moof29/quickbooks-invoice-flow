/**
 * QuickBooks API Rate Limiter
 *
 * QB has a limit of 500 requests per minute per company.
 * We use 450 as a safe buffer to avoid hitting the limit.
 *
 * Usage:
 *   await QBRateLimiter.checkLimit(organizationId);
 *   const response = await fetch(qbApiUrl, ...);
 */

interface RequestTimestamp {
  timestamps: number[];
  lastCleanup: number;
}

class QBRateLimiter {
  private static requestTimestamps: Map<string, RequestTimestamp> = new Map();
  private static readonly MAX_REQUESTS = 450; // Buffer below 500 limit
  private static readonly WINDOW_MS = 60000; // 1 minute window
  private static readonly CLEANUP_INTERVAL = 10000; // Cleanup every 10 seconds

  /**
   * Check if org can make request, wait if at limit
   * @param organizationId - Organization ID to track rate limit for
   */
  static async checkLimit(organizationId: string): Promise<void> {
    const now = Date.now();

    // Get or initialize timestamps for this org
    let orgData = this.requestTimestamps.get(organizationId);

    if (!orgData) {
      orgData = { timestamps: [], lastCleanup: now };
      this.requestTimestamps.set(organizationId, orgData);
    }

    // Cleanup old timestamps if needed
    if (now - orgData.lastCleanup > this.CLEANUP_INTERVAL) {
      orgData.timestamps = orgData.timestamps.filter(t => now - t < this.WINDOW_MS);
      orgData.lastCleanup = now;
    } else {
      // Quick cleanup: remove timestamps outside window
      orgData.timestamps = orgData.timestamps.filter(t => now - t < this.WINDOW_MS);
    }

    // Check if at limit
    if (orgData.timestamps.length >= this.MAX_REQUESTS) {
      const oldestTimestamp = orgData.timestamps[0];
      const waitTime = this.WINDOW_MS - (now - oldestTimestamp) + 100; // +100ms buffer

      console.log(`[Rate Limit] Org ${organizationId} at ${this.MAX_REQUESTS} requests/min, waiting ${waitTime}ms`);

      // Wait until window resets
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Recurse to check again after wait
      return this.checkLimit(organizationId);
    }

    // Add current request timestamp
    orgData.timestamps.push(now);
  }

  /**
   * Get current rate limit stats for org
   * @param organizationId - Organization ID to get stats for
   * @returns Rate limit statistics
   */
  static getStats(organizationId: string): {
    count: number;
    limit: number;
    remaining: number;
    windowStart: Date;
    percentUsed: number;
  } {
    const now = Date.now();
    const orgData = this.requestTimestamps.get(organizationId);

    if (!orgData) {
      return {
        count: 0,
        limit: this.MAX_REQUESTS,
        remaining: this.MAX_REQUESTS,
        windowStart: new Date(now - this.WINDOW_MS),
        percentUsed: 0
      };
    }

    // Clean up old timestamps
    const validTimestamps = orgData.timestamps.filter(t => now - t < this.WINDOW_MS);
    const count = validTimestamps.length;

    return {
      count,
      limit: this.MAX_REQUESTS,
      remaining: this.MAX_REQUESTS - count,
      windowStart: new Date(now - this.WINDOW_MS),
      percentUsed: (count / this.MAX_REQUESTS) * 100
    };
  }

  /**
   * Reset rate limiter for org (useful for testing)
   * @param organizationId - Organization ID to reset
   */
  static reset(organizationId: string): void {
    this.requestTimestamps.delete(organizationId);
    console.log(`[Rate Limit] Reset for org ${organizationId}`);
  }

  /**
   * Reset all rate limiters (useful for testing)
   */
  static resetAll(): void {
    this.requestTimestamps.clear();
    console.log('[Rate Limit] Reset all organizations');
  }

  /**
   * Get total tracked organizations
   */
  static getTrackedOrganizations(): number {
    return this.requestTimestamps.size;
  }
}

export default QBRateLimiter;
