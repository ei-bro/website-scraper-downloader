/**
 * Domain filtering and depth tracking
 * Validates: Requirements 9.2, 9.3, 9.4, 14.2, 14.3
 */

import { extractDomain } from '../url/validator';

/**
 * Checks if a URL should be downloaded based on domain filtering rules
 *
 * @param url - The URL to check
 * @param targetDomain - The target domain from the starting URL
 * @param includeSubdomains - Whether to include subdomain resources
 * @returns True if the URL should be downloaded, false otherwise
 *
 * Validates: Requirements 9.2, 9.3, 9.4
 */
export function shouldDownloadUrl(
  url: string,
  targetDomain: string,
  includeSubdomains: boolean,
): boolean {
  try {
    const urlDomain = extractDomain(url);

    // Exact domain match - always download
    if (urlDomain === targetDomain) {
      return true;
    }

    // If subdomains are included, check if urlDomain is a subdomain of targetDomain
    if (includeSubdomains) {
      // Check if urlDomain ends with .targetDomain
      // e.g., "sub.example.com" ends with ".example.com"
      return urlDomain.endsWith(`.${targetDomain}`);
    }

    // Different domain and subdomains not included - skip
    return false;
  } catch (_error) {
    // Invalid URL - skip
    return false;
  }
}

/**
 * Checks if a resource should be processed based on depth limits
 *
 * @param currentDepth - The depth of the current resource
 * @param maxDepth - The maximum allowed depth (null for unlimited)
 * @returns True if the resource should be processed, false otherwise
 *
 * Validates: Requirements 14.2, 14.3
 */
export function shouldProcessDepth(currentDepth: number, maxDepth: number | null): boolean {
  // No depth limit - always process
  if (maxDepth === null) {
    return true;
  }

  // Check if current depth is within limit
  return currentDepth <= maxDepth;
}

/**
 * Checks if links from a resource at the given depth should be followed
 *
 * @param currentDepth - The depth of the current resource
 * @param maxDepth - The maximum allowed depth (null for unlimited)
 * @returns True if links should be followed, false otherwise
 *
 * Validates: Requirements 14.3
 */
export function shouldFollowLinks(currentDepth: number, maxDepth: number | null): boolean {
  // No depth limit - always follow links
  if (maxDepth === null) {
    return true;
  }

  // Only follow links if we haven't reached max depth yet
  // Resources at maxDepth should not have their links followed
  return currentDepth < maxDepth;
}
