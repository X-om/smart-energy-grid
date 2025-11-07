/**
 * Time utilities for windowing and time bucket operations
 */

/**
 * Get the 1-minute window bucket for a timestamp
 * Returns ISO string truncated to minute precision (e.g., "2025-11-07T10:24:00.000Z")
 */
export function get1MinuteBucket(timestamp: string | Date): string {
  const date = new Date(timestamp);
  // Truncate to minute precision
  date.setSeconds(0, 0);
  return date.toISOString();
}

/**
 * Get the 15-minute window bucket for a timestamp
 * Rounds down to the nearest 15-minute interval
 */
export function get15MinuteBucket(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const minutes = date.getMinutes();
  const roundedMinutes = Math.floor(minutes / 15) * 15;
  date.setMinutes(roundedMinutes, 0, 0);
  return date.toISOString();
}

/**
 * Get all 1-minute buckets within a 15-minute window
 */
export function get1MinuteBucketsIn15MinWindow(windowStart: string | Date): string[] {
  const buckets: string[] = [];
  const start = new Date(windowStart);

  for (let i = 0; i < 15; i++) {
    const bucket = new Date(start);
    bucket.setMinutes(start.getMinutes() + i);
    buckets.push(bucket.toISOString());
  }

  return buckets;
}

/**
 * Check if a timestamp is within the last N minutes
 */
export function isWithinLastMinutes(timestamp: string | Date, minutes: number): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes <= minutes;
}

/**
 * Get the current 1-minute bucket
 */
export function getCurrentMinuteBucket(): string {
  return get1MinuteBucket(new Date());
}

/**
 * Get the current 15-minute bucket
 */
export function getCurrent15MinuteBucket(): string {
  return get15MinuteBucket(new Date());
}

/**
 * Calculate lag in seconds between a timestamp and now
 */
export function calculateLagSeconds(timestamp: string | Date): number {
  const date = new Date(timestamp);
  const now = new Date();
  return (now.getTime() - date.getTime()) / 1000;
}
