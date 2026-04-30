/**
 * Core type definitions for the Website Scraper Downloader
 */

import type { DownloadQueue } from './queue';

/**
 * Enum representing different types of resources that can be downloaded
 */
export enum ResourceType {
  HTML = 'html',
  CSS = 'css',
  JavaScript = 'javascript',
  Image = 'image',
  Font = 'font',
  Media = 'media',
  Other = 'other',
}

/**
 * Represents a discovered resource to be downloaded
 */
export interface Resource {
  /** Absolute URL of the resource */
  url: string;
  /** Normalized URL for deduplication */
  normalizedUrl: string;
  /** Link depth from starting URL */
  depth: number;
  /** URL of the page that linked to this resource */
  referrer: string;
  /** Type of resource */
  type: ResourceType;
  /** Whether resource has been downloaded */
  downloaded: boolean;
}

/**
 * Represents a resource in the download queue
 */
export interface QueuedResource {
  /** Absolute URL of the resource */
  url: string;
  /** Link depth from starting URL */
  depth: number;
  /** URL of the page that linked to this resource */
  referrer: string;
}

/**
 * Configuration for the scraper
 */
export interface ScraperConfig {
  /** Maximum number of retry attempts for failed downloads */
  maxRetries: number;
  /** Request timeout in milliseconds */
  timeout: number;
  /** User agent string for HTTP requests */
  userAgent: string;
  /** Maximum number of concurrent downloads */
  maxConcurrent: number;
  /** Whether to respect robots.txt */
  respectRobotsTxt: boolean;
}

/**
 * Statistics tracked during a download session
 */
export interface SessionStats {
  /** Number of resources discovered */
  discovered: number;
  /** Number of resources successfully downloaded */
  downloaded: number;
  /** Number of resources that failed to download */
  failed: number;
  /** Total bytes downloaded */
  totalBytes: number;
  /** List of failed downloads with error details */
  failures: FailureRecord[];
}

/**
 * Record of a failed download
 */
export interface FailureRecord {
  /** URL that failed to download */
  url: string;
  /** Error message */
  error: string;
  /** HTTP status code if applicable */
  statusCode?: number;
}

/**
 * Tracks the state of an active scraping session
 */
export interface DownloadSession {
  /** Target URL to scrape */
  targetUrl: string;
  /** Target domain extracted from URL */
  targetDomain: string;
  /** Output directory for downloaded files */
  outputDirectory: string;
  /** Maximum link depth (null for unlimited) */
  maxDepth: number | null;
  /** Whether to include subdomain resources */
  includeSubdomains: boolean;
  /** Session start time */
  startTime: Date;
  /** Download queue manager */
  queue: DownloadQueue;
  /** Set of visited URLs */
  visited: Set<string>;
  /** Session statistics */
  stats: SessionStats;
}

/**
 * Result of a URL validation
 */
export interface ValidationResult {
  /** Whether the URL is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Normalized URL if valid */
  normalizedUrl?: string;
}

/**
 * Result of a download operation
 */
export interface DownloadResult {
  /** Whether the download was successful */
  success: boolean;
  /** Downloaded content as Buffer */
  content?: Buffer;
  /** Content type from response headers */
  contentType?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Resources discovered during parsing
 */
export interface ParsedResources {
  /** URLs discovered in the content */
  links: string[];
  /** Base URL for resolving relative paths */
  baseUrl: string;
}

/**
 * Result of a file write operation
 */
export interface WriteResult {
  /** Whether the write was successful */
  success: boolean;
  /** Local path where file was written */
  path?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Progress statistics for display
 */
export interface ProgressStats {
  /** Number of resources discovered */
  discovered: number;
  /** Number of resources downloaded */
  downloaded: number;
  /** Number of resources that failed */
  failed: number;
  /** Current file being processed */
  currentFile: string;
}

/**
 * Final download report
 */
export interface DownloadReport {
  /** Total number of files processed */
  totalFiles: number;
  /** Number of successful downloads */
  successfulDownloads: number;
  /** Number of failed downloads */
  failedDownloads: number;
  /** Total size in bytes */
  totalSize: number;
  /** List of failures */
  failures: FailureRecord[];
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Command-line options
 */
export interface CLIOptions {
  /** Target URL to scrape */
  url: string;
  /** Output directory path (optional) */
  output?: string;
  /** Maximum link depth (optional, default: unlimited) */
  maxDepth?: number;
  /** Include subdomain resources (optional, default: false) */
  includeSubdomains?: boolean;
}
