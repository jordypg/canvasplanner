/**
 * Retry utility with exponential backoff for failed operations
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param options Retry configuration options
 * @returns Promise resolving to the function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!opts.shouldRetry(error)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === opts.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );

      // Call onRetry callback
      opts.onRetry(error, attempt + 1);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable (network errors, timeouts, etc.)
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.name === 'NetworkError' || error?.message?.includes('network')) {
    return true;
  }

  // Timeout errors
  if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
    return true;
  }

  // HTTP 5xx errors (server errors)
  if (error?.status >= 500 && error?.status < 600) {
    return true;
  }

  // HTTP 429 (rate limit)
  if (error?.status === 429) {
    return true;
  }

  // Convex temporary errors
  if (error?.message?.includes('temporary') || error?.message?.includes('unavailable')) {
    return true;
  }

  return false;
}
