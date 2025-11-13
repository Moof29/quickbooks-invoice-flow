class QBRateLimiter {
  private static requestTimestamps: Map<string, number[]> = new Map();
  private static readonly MAX_REQUESTS = 450;
  private static readonly WINDOW_MS = 60000;

  static async checkLimit(organizationId: string): Promise<void> {
    const now = Date.now();

    let timestamps = this.requestTimestamps.get(organizationId) || [];

    timestamps = timestamps.filter((t) => now - t < this.WINDOW_MS);

    if (timestamps.length >= this.MAX_REQUESTS) {
      const oldestTimestamp = timestamps[0];
      const waitTime = this.WINDOW_MS - (now - oldestTimestamp) + 100;

      console.log(
        `[Rate Limit] Org ${organizationId} at ${this.MAX_REQUESTS} requests, waiting ${waitTime}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));

      return this.checkLimit(organizationId);
    }

    timestamps.push(now);
    this.requestTimestamps.set(organizationId, timestamps);
  }

  static getStats(organizationId: string): {
    count: number;
    limit: number;
    windowStart: Date;
  } {
    const now = Date.now();
    const timestamps = this.requestTimestamps.get(organizationId) || [];
    const validTimestamps = timestamps.filter((t) => now - t < this.WINDOW_MS);

    return {
      count: validTimestamps.length,
      limit: this.MAX_REQUESTS,
      windowStart: new Date(now - this.WINDOW_MS),
    };
  }

  static reset(organizationId: string): void {
    this.requestTimestamps.delete(organizationId);
  }
}

export default QBRateLimiter;
