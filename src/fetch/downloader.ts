/**
 * HTTP downloader module for fetching resources from URLs
 */

import axios, { type AxiosError } from 'axios';
import type { DownloadResult } from '../types';

/**
 * Default configuration for HTTP requests
 */
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; WebScraperDownloader/1.0)';

/**
 * Downloads a resource from the specified URL with retry logic
 *
 * @param url - The URL to download from
 * @param timeout - Request timeout in milliseconds (default: 30000)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns DownloadResult containing content, contentType, statusCode, or error
 *
 * **Validates: Requirements 2.1, 4.1, 5.1, 6.1, 11.1, 11.2, 11.3, 11.4, 11.5**
 */
export async function downloadResource(
  url: string,
  timeout: number = DEFAULT_TIMEOUT,
  maxRetries: number = 3,
): Promise<DownloadResult> {
  let lastError: DownloadResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
        },
        validateStatus: (status) => status < 600, // Accept all status codes < 600
      });

      // Check if the response was successful (2xx status codes)
      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          content: Buffer.from(response.data),
          contentType: response.headers['content-type'] || 'application/octet-stream',
          statusCode: response.status,
        };
      }

      // Handle HTTP error status codes (4xx, 5xx)
      // Don't retry on client errors (4xx) or server errors (5xx)
      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText || 'Request failed'}`,
      };
    } catch (error) {
      // Handle network errors gracefully
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Timeout error - retry with exponential backoff
        if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
          lastError = {
            success: false,
            error: `Request timeout after ${timeout}ms`,
          };

          // If we have retries left, wait with exponential backoff
          if (attempt < maxRetries) {
            const backoffMs = 2 ** attempt * 1000; // 1s, 2s, 4s
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          return lastError;
        }

        // Network connection errors - retry with exponential backoff
        if (
          axiosError.code === 'ENOTFOUND' ||
          axiosError.code === 'ECONNREFUSED' ||
          axiosError.code === 'EAI_AGAIN'
        ) {
          lastError = {
            success: false,
            error: `Network error: ${axiosError.message}`,
          };

          // If we have retries left, wait with exponential backoff
          if (attempt < maxRetries) {
            const backoffMs = 2 ** attempt * 1000; // 1s, 2s, 4s
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          return lastError;
        }

        // Other axios errors - don't retry
        return {
          success: false,
          statusCode: axiosError.response?.status,
          error: axiosError.message || 'Download failed',
        };
      }

      // Handle non-axios errors - don't retry
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // This should never be reached, but return last error as fallback
  return (
    lastError || {
      success: false,
      error: 'Unknown error occurred',
    }
  );
}
