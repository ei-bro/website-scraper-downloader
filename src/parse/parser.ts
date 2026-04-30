/**
 * Resource parser for extracting URLs from HTML and CSS content
 */

import type { ParsedResources } from '../types';
import { resolveRelativeUrl } from '../url/validator';

/**
 * Parses HTML content and extracts all resource URLs
 * @param content - HTML content to parse
 * @param baseUrl - Base URL for resolving relative URLs
 * @returns ParsedResources containing discovered links
 */
export function parseHtml(content: string, baseUrl: string): ParsedResources {
  const links: string[] = [];
  const seenUrls = new Set<string>();

  // Extract URLs from href attributes (link and anchor tags)
  const hrefPattern = /<(?:a|link)\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = hrefPattern.exec(content)) !== null) {
    const url = match[1].trim();
    if (
      url &&
      !url.startsWith('#') &&
      !url.startsWith('javascript:') &&
      !url.startsWith('mailto:')
    ) {
      try {
        const resolvedUrl = resolveRelativeUrl(baseUrl, url);
        if (!seenUrls.has(resolvedUrl)) {
          seenUrls.add(resolvedUrl);
          links.push(resolvedUrl);
        }
      } catch (_e) {
        // Skip invalid URLs
      }
    }
  }

  // Extract URLs from src attributes (script, img, iframe, source tags)
  const srcPattern = /<(?:script|img|iframe|source)\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((match = srcPattern.exec(content)) !== null) {
    const url = match[1].trim();
    if (url) {
      try {
        const resolvedUrl = resolveRelativeUrl(baseUrl, url);
        if (!seenUrls.has(resolvedUrl)) {
          seenUrls.add(resolvedUrl);
          links.push(resolvedUrl);
        }
      } catch (_e) {
        // Skip invalid URLs
      }
    }
  }

  // Extract URLs from style attributes
  const styleAttrPattern = /style\s*=\s*["']([^"']*url\([^)]+\)[^"']*)["']/gi;
  while ((match = styleAttrPattern.exec(content)) !== null) {
    const styleContent = match[1];
    const urlsInStyle = extractUrlsFromCss(styleContent, baseUrl);
    urlsInStyle.forEach((url) => {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        links.push(url);
      }
    });
  }

  // Extract URLs from style tags
  const styleTagPattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((match = styleTagPattern.exec(content)) !== null) {
    const styleContent = match[1];
    const urlsInStyle = extractUrlsFromCss(styleContent, baseUrl);
    urlsInStyle.forEach((url) => {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        links.push(url);
      }
    });
  }

  return {
    links,
    baseUrl,
  };
}

/**
 * Parses CSS content and extracts all resource URLs
 * @param content - CSS content to parse
 * @param baseUrl - Base URL for resolving relative URLs
 * @returns ParsedResources containing discovered links
 */
export function parseCss(content: string, baseUrl: string): ParsedResources {
  const links: string[] = [];
  const seenUrls = new Set<string>();

  // Extract URLs from @import statements
  const importPattern = /@import\s+(?:url\s*\(\s*)?["']?([^"')]+)["']?\s*\)?[^;]*;/gi;
  let match;
  while ((match = importPattern.exec(content)) !== null) {
    const url = match[1].trim();
    if (url && !url.startsWith('data:')) {
      try {
        const resolvedUrl = resolveRelativeUrl(baseUrl, url);
        if (!seenUrls.has(resolvedUrl)) {
          seenUrls.add(resolvedUrl);
          links.push(resolvedUrl);
        }
      } catch (_e) {
        // Skip invalid URLs
      }
    }
  }

  // Extract URLs from url() functions
  const urlPattern = /url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((match = urlPattern.exec(content)) !== null) {
    const url = match[1].trim();
    if (url && !url.startsWith('data:')) {
      try {
        const resolvedUrl = resolveRelativeUrl(baseUrl, url);
        if (!seenUrls.has(resolvedUrl)) {
          seenUrls.add(resolvedUrl);
          links.push(resolvedUrl);
        }
      } catch (_e) {
        // Skip invalid URLs
      }
    }
  }

  return {
    links,
    baseUrl,
  };
}

/**
 * Helper function to extract URLs from CSS content
 * @param cssContent - CSS content to parse
 * @param baseUrl - Base URL for resolving relative URLs
 * @returns Array of resolved URLs
 */
function extractUrlsFromCss(cssContent: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const urlPattern = /url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let match;

  while ((match = urlPattern.exec(cssContent)) !== null) {
    const url = match[1].trim();
    if (url && !url.startsWith('data:')) {
      try {
        const resolvedUrl = resolveRelativeUrl(baseUrl, url);
        urls.push(resolvedUrl);
      } catch (_e) {
        // Skip invalid URLs
      }
    }
  }

  return urls;
}
