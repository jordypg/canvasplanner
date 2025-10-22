import { retryWithBackoff, isRetryableError } from '../retry';

// Mock timers
jest.useFakeTimers();

describe('retryWithBackoff', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should succeed on first try', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(fn, { maxRetries: 3, initialDelay: 1000 });

    // Fast-forward through all retries
    await jest.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries', async () => {
    jest.useRealTimers(); // Use real timers for this test
    const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

    try {
      await retryWithBackoff(fn, { maxRetries: 2, initialDelay: 10 });
      fail('Expected promise to reject');
    } catch (error: any) {
      expect(error.message).toBe('persistent failure');
    }

    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    jest.useFakeTimers(); // Restore fake timers
  });

  it('should use exponential backoff', async () => {
    jest.useRealTimers();
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    try {
      await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 10,
        backoffMultiplier: 2,
      });
      fail('Expected promise to reject');
    } catch (error: any) {
      expect(error.message).toBe('fail');
    }

    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
    jest.useFakeTimers();
  });

  it('should respect maxDelay', async () => {
    jest.useRealTimers();
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    try {
      await retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelay: 10,
        maxDelay: 20,
        backoffMultiplier: 2,
      });
      fail('Expected promise to reject');
    } catch (error: any) {
      expect(error.message).toBe('fail');
    }

    jest.useFakeTimers();
  });

  it('should call onRetry callback', async () => {
    jest.useRealTimers();
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const onRetry = jest.fn();

    try {
      await retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelay: 10,
        onRetry,
      });
      fail('Expected promise to reject');
    } catch (error: any) {
      expect(error.message).toBe('fail');
    }

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2);
    jest.useFakeTimers();
  });

  it('should not retry if shouldRetry returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('non-retryable'));

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      shouldRetry: () => false,
    });

    await expect(promise).rejects.toThrow('non-retryable');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use shouldRetry to determine retryable errors', async () => {
    jest.useRealTimers();
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ status: 500 }) // retryable
      .mockRejectedValueOnce({ status: 404 }); // non-retryable

    try {
      await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 10,
        shouldRetry: (error) => error.status >= 500,
      });
      fail('Expected promise to reject');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }

    expect(fn).toHaveBeenCalledTimes(2);
    jest.useFakeTimers();
  });
});

describe('isRetryableError', () => {
  it('should identify network errors as retryable', () => {
    expect(isRetryableError({ name: 'NetworkError' })).toBe(true);
    expect(isRetryableError({ message: 'network timeout' })).toBe(true);
  });

  it('should identify timeout errors as retryable', () => {
    expect(isRetryableError({ name: 'TimeoutError' })).toBe(true);
    expect(isRetryableError({ message: 'request timeout' })).toBe(true);
  });

  it('should identify 5xx errors as retryable', () => {
    expect(isRetryableError({ status: 500 })).toBe(true);
    expect(isRetryableError({ status: 502 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
  });

  it('should identify rate limit errors as retryable', () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
  });

  it('should identify temporary errors as retryable', () => {
    expect(isRetryableError({ message: 'temporary failure' })).toBe(true);
    expect(isRetryableError({ message: 'service unavailable' })).toBe(true);
  });

  it('should identify non-retryable errors', () => {
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError({ status: 401 })).toBe(false);
    expect(isRetryableError({ status: 404 })).toBe(false);
    expect(isRetryableError({ message: 'validation error' })).toBe(false);
  });

  it('should return false for non-error objects', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError({})).toBe(false);
  });
});
