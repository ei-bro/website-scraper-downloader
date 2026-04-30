/**
 * URL validation and connectivity testing
 * Validates: Requirements 1.1, 1.2, 1.3, 9.1
 */

import axios from 'axios';
import type { ValidationResult } from './types';

/**
 * Validates a URL string for correct format
 *
 * @param url - The URL string to validate
 * @returns ValidationResult with valid flag, error message, and normalized URL
 *
 * Validates: Requirements 1.1, 1.2
 */
export function validateUrl(url: string): ValidationResult {
  // Check for empty or whitespace-only strings
  if (!url || url.trim().length === 0) {
    return {
      valid: false,
      error: 'URL cannot be empty',
    };
  }

  // Try to parse the URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }

  // Check for supported protocols (http and https only)
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return {
      valid: false,
      error: `Unsupported protocol: ${parsedUrl.protocol}. Only http and https are supported`,
    };
  }

  // Check for valid hostname
  if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
    return {
      valid: false,
      error: 'URL must have a valid hostname',
    };
  }

  // Return success with normalized URL
  return {
    valid: true,
    normalizedUrl: parsedUrl.href,
  };
}

/**
 * Checks if a URL is reachable by making a HEAD request
 *
 * @param url - The URL to check for connectivity
 * @returns Promise<boolean> - true if reachable, false otherwise
 *
 * Validates: Requirements 1.3
 */
export async function isReachable(url: string): Promise<boolean> {
  try {
    // Use HEAD request for efficiency (doesn't download body)
    const response = await axios.head(url, {
      timeout: 10000, // 10 second timeout
      validateStatus: status => status < 500, // Accept any status < 500 as "reachable"
    });

    // Consider 2xx, 3xx, and 4xx as reachable (server responded)
    return response.status < 500;
  } catch (error) {
    // Network errors, timeouts, DNS failures mean unreachable
    return false;
  }
}

/**
 * Extracts the domain from a URL
 *
 * @param url - The URL to extract domain from
 * @returns The domain string (hostname)
 * @throws Error if URL is invalid
 *
 * Validates: Requirements 9.1
 */
export function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (error) {
    throw new Error(`Cannot extract domain from invalid URL: ${url}`);
  }
}

/**
 * Normalizes a URL to a canonical form for deduplication
 * - Removes trailing slashes from paths (except root path)
 * - Converts to lowercase hostname
 * - Sorts query parameters alphabetically
 * - Removes default ports (80 for http, 443 for https)
 * - Removes fragment identifiers
 *
 * @param url - The URL to normalize
 * @returns The normalized URL string
 * @throws Error if URL is invalid
 *
 * Validates: Requirements 8.1, 8.2
 */
export function normalizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);

    // Normalize hostname to lowercase
    parsedUrl.hostname = parsedUrl.hostname.toLowerCase();

    // Remove default ports
    if (
      (parsedUrl.protocol === 'http:' && parsedUrl.port === '80') ||
      (parsedUrl.protocol === 'https:' && parsedUrl.port === '443')
    ) {
      parsedUrl.port = '';
    }

    // Remove trailing slash from pathname (except for root path)
    if (parsedUrl.pathname.length > 1 && parsedUrl.pathname.endsWith('/')) {
      parsedUrl.pathname = parsedUrl.pathname.slice(0, -1);
    }

    // Sort query parameters alphabetically for consistency
    if (parsedUrl.search) {
      const params = new URLSearchParams(parsedUrl.search);
      const sortedParams = new URLSearchParams(
        Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      );
      parsedUrl.search = sortedParams.toString();
    }

    // Remove fragment identifier (hash)
    parsedUrl.hash = '';

    return parsedUrl.href;
  } catch (error) {
    throw new Error(`Cannot normalize invalid URL: ${url}`);
  }
}

/**
 * Resolves a relative URL against a base URL to produce an absolute URL
 *
 * @param baseUrl - The base URL to resolve against
 * @param relativeUrl - The relative URL to resolve (can also be absolute)
 * @returns The resolved absolute URL
 * @throws Error if either URL is invalid or resolution fails
 *
 * Validates: Requirements 7.4, 8.3
 */
export function resolveRelativeUrl(
  baseUrl: string,
  relativeUrl: string,
): string {
  try {
    // If relativeUrl is already absolute, return it as-is
    try {
      const absoluteUrl = new URL(relativeUrl);
      return absoluteUrl.href;
    } catch {
      // Not an absolute URL, continue with resolution
    }

    // Resolve relative URL against base URL
    const parsedBase = new URL(baseUrl);
    const resolved = new URL(relativeUrl, parsedBase);
    return resolved.href;
  } catch (error) {
    throw new Error(
      `Cannot resolve relative URL "${relativeUrl}" against base "${baseUrl}"`,
    );
  }
}
