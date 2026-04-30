/**
 * Property-based tests for HTTP downloader retry logic
 * Feature: website-scraper-downloader
 * Tests Requirements 11.4
 */

import * as fc from 'fast-check';
import axios from 'axios';
import { downloadResource } from './downloader';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HTTP Downloader - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Property 17: Retry Logic
   * For any download that fails due to network timeout, the scraper should
   * retry up to 3 times before marking it as failed.
   * **Validates: Requirements 11.4**
   */
  describe('Property 17: Retry Logic', () => {
    it('Feature: website-scraper-downloader, Property 17: Retry Logic', async () => {
      // Generator for URLs
      const urlArbitrary = fc.webUrl({ validSchemes: ['http', 'https'] });

      // Generator for timeout values (reasonable range)
      const timeoutArbitrary = fc.integer({ min: 1000, max: 60000 });

      // Generator for retry-able error codes
      const retryableErrorCodeArbitrary = fc.constantFrom(
        'ECONNABORTED',
        'ECONNREFUSED',
        'ENOTFOUND',
        'EAI_AGAIN',
      );

      await fc.assert(
        fc.asyncProperty(
          urlArbitrary,
          timeoutArbitrary,
          retryableErrorCodeArbitrary,
          async (url, timeout, errorCode) => {
            // Clear mocks for each property test iteration
            jest.clearAllMocks();

            // Create a retryable error
            const retryableError = {
              code: errorCode,
              message: `Network error: ${errorCode}`,
              isAxiosError: true,
            };

            mockedAxios.isAxiosError.mockReturnValue(true);
            mockedAxios.get.mockRejectedValue(retryableError);

            // Start the download
            const downloadPromise = downloadResource(url, timeout);

            // Fast-forward through all timers
            await jest.runAllTimersAsync();

            const result = await downloadPromise;

            // Property: Download should fail after retries
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();

            // Property: Should attempt exactly 4 times (initial + 3 retries)
            expect(mockedAxios.get).toHaveBeenCalledTimes(4);

            // Property: All calls should use the same URL and timeout
            for (let i = 0; i < 4; i++) {
              expect(mockedAxios.get).toHaveBeenNthCalledWith(
                i + 1,
                url,
                expect.objectContaining({
                  timeout,
                }),
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should succeed on retry if request eventually succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.integer({ min: 1000, max: 60000 }),
          fc.integer({ min: 1, max: 3 }), // Number of failures before success
          fc.string({ minLength: 1, maxLength: 1000 }), // Response content
          async (url, timeout, failureCount, content) => {
            // Clear mocks for each property test iteration
            jest.clearAllMocks();

            const timeoutError = {
              code: 'ECONNABORTED',
              message: 'timeout exceeded',
              isAxiosError: true,
            };

            mockedAxios.isAxiosError.mockReturnValue(true);

            // Fail N times, then succeed
            for (let i = 0; i < failureCount; i++) {
              mockedAxios.get.mockRejectedValueOnce(timeoutError);
            }
            mockedAxios.get.mockResolvedValueOnce({
              status: 200,
              statusText: 'OK',
              data: Buffer.from(content),
              headers: { 'content-type': 'text/html' },
            });

            const downloadPromise = downloadResource(url, timeout);

            // Fast-forward through all timers
            await jest.runAllTimersAsync();

            const result = await downloadPromise;

            // Property: Download should succeed
            expect(result.success).toBe(true);
            expect(result.content?.toString()).toBe(content);
            expect(result.statusCode).toBe(200);

            // Property: Should attempt exactly failureCount + 1 times
            expect(mockedAxios.get).toHaveBeenCalledTimes(failureCount + 1);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should respect custom maxRetries parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.integer({ min: 1000, max: 60000 }),
          fc.integer({ min: 0, max: 10 }), // Custom retry count
          async (url, timeout, maxRetries) => {
            // Clear mocks for each property test iteration
            jest.clearAllMocks();

            const timeoutError = {
              code: 'ECONNABORTED',
              message: 'timeout exceeded',
              isAxiosError: true,
            };

            mockedAxios.isAxiosError.mockReturnValue(true);
            mockedAxios.get.mockRejectedValue(timeoutError);

            const downloadPromise = downloadResource(url, timeout, maxRetries);

            // Fast-forward through all timers
            await jest.runAllTimersAsync();

            const result = await downloadPromise;

            // Property: Download should fail
            expect(result.success).toBe(false);

            // Property: Should attempt exactly maxRetries + 1 times (initial + retries)
            expect(mockedAxios.get).toHaveBeenCalledTimes(maxRetries + 1);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not retry on HTTP error status codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.integer({ min: 1000, max: 60000 }),
          fc.constantFrom(400, 401, 403, 404, 500, 502, 503), // HTTP error codes
          async (url, timeout, statusCode) => {
            // Clear mocks for each property test iteration
            jest.clearAllMocks();

            mockedAxios.get.mockResolvedValue({
              status: statusCode,
              statusText: 'Error',
              data: Buffer.from(''),
              headers: {},
            });

            const result = await downloadResource(url, timeout);

            // Property: Download should fail
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(statusCode);

            // Property: Should attempt exactly once (no retries for HTTP errors)
            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should use exponential backoff between retries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.integer({ min: 1000, max: 60000 }),
          async (url, timeout) => {
            // Clear mocks for each property test iteration
            jest.clearAllMocks();

            const timeoutError = {
              code: 'ECONNABORTED',
              message: 'timeout exceeded',
              isAxiosError: true,
            };

            mockedAxios.isAxiosError.mockReturnValue(true);
            mockedAxios.get.mockRejectedValue(timeoutError);

            const downloadPromise = downloadResource(url, timeout);

            // First attempt
            await Promise.resolve();
            expect(mockedAxios.get).toHaveBeenCalledTimes(1);

            // Property: First retry after 1 second (2^0 * 1000ms)
            await jest.advanceTimersByTimeAsync(1000);
            expect(mockedAxios.get).toHaveBeenCalledTimes(2);

            // Property: Second retry after 2 seconds (2^1 * 1000ms)
            await jest.advanceTimersByTimeAsync(2000);
            expect(mockedAxios.get).toHaveBeenCalledTimes(3);

            // Property: Third retry after 4 seconds (2^2 * 1000ms)
            await jest.advanceTimersByTimeAsync(4000);
            expect(mockedAxios.get).toHaveBeenCalledTimes(4);

            await downloadPromise;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle all retryable error types consistently', async () => {
      const retryableErrors = [
        { code: 'ECONNABORTED', message: 'timeout exceeded' },
        { code: 'ECONNREFUSED', message: 'connection refused' },
        { code: 'ENOTFOUND', message: 'DNS lookup failed' },
        { code: 'EAI_AGAIN', message: 'DNS temporary failure' },
      ];

      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.integer({ min: 1000, max: 60000 }),
          fc.constantFrom(...retryableErrors),
          async (url, timeout, errorConfig) => {
            // Clear mocks for each property test iteration
            jest.clearAllMocks();

            const error = {
              ...errorConfig,
              isAxiosError: true,
            };

            mockedAxios.isAxiosError.mockReturnValue(true);
            mockedAxios.get.mockRejectedValue(error);

            const downloadPromise = downloadResource(url, timeout);

            // Fast-forward through all timers
            await jest.runAllTimersAsync();

            const result = await downloadPromise;

            // Property: All retryable errors should trigger retry logic
            expect(result.success).toBe(false);
            expect(mockedAxios.get).toHaveBeenCalledTimes(4); // Initial + 3 retries

            // Property: Error message should be preserved
            expect(result.error).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not retry on non-retryable axios errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.integer({ min: 1000, max: 60000 }),
          fc.string({ minLength: 1, maxLength: 100 }), // Error message
          async (url, timeout, errorMessage) => {
            // Clear mocks for each property test iteration
            jest.clearAllMocks();

            const nonRetryableError = {
              message: errorMessage,
              isAxiosError: true,
              // No code property - makes it non-retryable
            };

            mockedAxios.isAxiosError.mockReturnValue(true);
            mockedAxios.get.mockRejectedValue(nonRetryableError);

            const result = await downloadResource(url, timeout);

            // Property: Download should fail
            expect(result.success).toBe(false);
            expect(result.error).toBe(errorMessage);

            // Property: Should attempt exactly once (no retries)
            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
