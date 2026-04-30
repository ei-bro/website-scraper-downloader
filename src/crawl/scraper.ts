/**
 * Scraper controller - orchestrates the main download workflow
 * Validates: Requirements 2.3, 11.5
 */

import { downloadResource } from '../fetch/downloader';
import { writeFile } from '../fs/writer';
import { parseCss, parseHtml } from '../parse/parser';
import { ProgressReporter } from '../progress/progress';
import type { QueuedResource, SessionStats } from '../types';
import { extractDomain, normalizeUrl } from '../url/validator';
import { shouldDownloadUrl, shouldFollowLinks } from './filter';
import { DownloadQueue } from './queue';

/**
 * Options for the scraper
 */
export interface ScraperOptions {
  /** Target URL to start scraping from */
  targetUrl: string;
  /** Output directory for downloaded files */
  outputDir: string;
  /** Maximum depth to follow links (null for unlimited) */
  maxDepth: number | null;
  /** Whether to include subdomain resources */
  includeSubdomains: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts for failed downloads */
  maxRetries?: number;
}

/**
 * Result of a scraping session
 */
export interface ScraperResult {
  /** Session statistics */
  stats: SessionStats;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Main scraper controller that orchestrates the download workflow
 *
 * @param options - Scraper configuration options
 * @returns ScraperResult with statistics and duration
 *
 * Validates: Requirements 2.3, 11.5
 */
export async function scrape(options: ScraperOptions): Promise<ScraperResult> {
  const startTime = Date.now();
  const queue = new DownloadQueue();
  const progress = new ProgressReporter();
  const targetDomain = extractDomain(options.targetUrl);

  // Initialize session stats
  const stats: SessionStats = {
    discovered: 0,
    downloaded: 0,
    failed: 0,
    totalBytes: 0,
    failures: [],
  };

  // Enqueue the initial URL
  const initialResource: QueuedResource = {
    url: options.targetUrl,
    depth: 0,
    referrer: '',
  };
  queue.enqueue(initialResource);
  queue.markVisited(normalizeUrl(options.targetUrl));
  stats.discovered = 1;

  // Main download loop
  while (!queue.isEmpty()) {
    const resource = queue.dequeue();
    if (!resource) break;

    // Update progress
    progress.update({
      discovered: stats.discovered,
      downloaded: stats.downloaded,
      failed: stats.failed,
      currentFile: resource.url,
    });

    // Download the resource
    const downloadResult = await downloadResource(
      resource.url,
      options.timeout,
      options.maxRetries,
    );

    if (!downloadResult.success) {
      // Handle download failure - log and continue
      stats.failed++;
      stats.failures.push({
        url: resource.url,
        error: downloadResult.error || 'Unknown error',
        statusCode: downloadResult.statusCode,
      });
      continue;
    }

    // Write file to disk
    const writeResult = await writeFile(resource.url, downloadResult.content!, options.outputDir);

    if (!writeResult.success) {
      // Handle write failure - log and continue
      stats.failed++;
      stats.failures.push({
        url: resource.url,
        error: writeResult.error || 'Failed to write file',
      });
      continue;
    }

    // Successfully downloaded and written
    stats.downloaded++;
    stats.totalBytes += downloadResult.content!.length;

    // Parse content for links if we should follow them
    if (shouldFollowLinks(resource.depth, options.maxDepth)) {
      const links = extractLinks(
        downloadResult.content!,
        downloadResult.contentType || '',
        resource.url,
      );

      // Process discovered links
      for (const link of links) {
        try {
          const normalizedLink = normalizeUrl(link);

          // Skip if already visited
          if (queue.hasVisited(normalizedLink)) {
            continue;
          }

          // Check domain filtering
          if (!shouldDownloadUrl(link, targetDomain, options.includeSubdomains)) {
            continue;
          }

          // Add to queue
          const newResource: QueuedResource = {
            url: link,
            depth: resource.depth + 1,
            referrer: resource.url,
          };
          queue.enqueue(newResource);
          queue.markVisited(normalizedLink);
          stats.discovered++;
        } catch (_error) {}
      }
    }
  }

  // Final progress update
  progress.update({
    discovered: stats.discovered,
    downloaded: stats.downloaded,
    failed: stats.failed,
    currentFile: '',
  });

  const duration = Date.now() - startTime;

  return {
    stats,
    duration,
  };
}

/**
 * Extracts links from downloaded content based on content type
 *
 * @param content - The downloaded content
 * @param contentType - The content type from HTTP headers
 * @param baseUrl - The URL of the current resource
 * @returns Array of discovered URLs
 */
function extractLinks(content: Buffer, contentType: string, baseUrl: string): string[] {
  const textContent = content.toString('utf-8');

  // Parse HTML content
  if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
    const parsed = parseHtml(textContent, baseUrl);
    return parsed.links;
  }

  // Parse CSS content
  if (contentType.includes('text/css')) {
    const parsed = parseCss(textContent, baseUrl);
    return parsed.links;
  }

  // No links to extract from other content types
  return [];
}
