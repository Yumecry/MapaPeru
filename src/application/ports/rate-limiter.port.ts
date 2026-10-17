export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface IRateLimiter {
  consume(bucket: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}
