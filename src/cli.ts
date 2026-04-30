#!/usr/bin/env node

/**
 * CLI entry point for the Website Scraper Downloader
 * Validates: Requirements 12.2, 12.3
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { type ScraperOptions, scrape } from './crawl/scraper';
import { generateReport, saveReport } from './report/report';
import type { CLIOptions, DownloadReport, FailureRecord, SessionStats } from './types';
import { extractDomain, isReachable, validateUrl } from './url/validator';

/**
 * Parses command-line arguments into CLIOptions
 *
 * @param args - Command-line arguments (typically process.argv.slice(2))
 * @returns CLIOptions object with parsed values
 * @throws Error if required arguments are missing or invalid
 *
 * Validates: Requirements 1.1, 1.2, 12.1, 12.2, 14.1
 */
export function parseArguments(args: string[]): CLIOptions {
  const options: CLIOptions = {
    url: '',
    output: undefined,
    maxDepth: undefined,
    includeSubdomains: false,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--url':
      case '-u':
        if (i + 1 >= args.length) {
          throw new Error('--url requires a value');
        }
        options.url = args[++i];
        break;

      case '--output':
      case '-o':
        if (i + 1 >= args.length) {
          throw new Error('--output requires a value');
        }
        options.output = args[++i];
        break;

      case '--max-depth':
      case '-d': {
        if (i + 1 >= args.length) {
          throw new Error('--max-depth requires a value');
        }
        const depth = parseInt(args[++i], 10);
        if (Number.isNaN(depth) || depth < 0) {
          throw new Error('--max-depth must be a non-negative integer');
        }
        options.maxDepth = depth;
        break;
      }

      case '--include-subdomains':
      case '-s':
        options.includeSubdomains = true;
        break;

      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;

      default:
        // If it doesn't start with -, treat it as the URL if not set
        if (!arg.startsWith('-') && !options.url) {
          options.url = arg;
        } else {
          throw new Error(`Unknown argument: ${arg}`);
        }
    }
  }

  // Validate required arguments
  if (!options.url) {
    throw new Error('URL is required. Use --url <url> or provide URL as first argument');
  }

  return options;
}

/**
 * Prints usage information to console
 */
function printUsage(): void {
  console.log(`
Website Scraper Downloader

Usage:
  scraper <url> [options]
  scraper --url <url> [options]

Options:
  -u, --url <url>              Target URL to scrape (required)
  -o, --output <dir>           Output directory (default: ./downloads/<domain>)
  -d, --max-depth <number>     Maximum link depth (default: unlimited)
  -s, --include-subdomains     Include subdomain resources
  -h, --help                   Show this help message

Examples:
  scraper https://example.com
  scraper https://example.com --output ./downloads
  scraper https://example.com --max-depth 2 --include-subdomains
  `);
}

/**
 * Displays a formatted download report
 *
 * @param stats - Session statistics
 * @param duration - Duration in milliseconds
 */
function displayReport(stats: SessionStats, duration: number): void {
  const durationSeconds = (duration / 1000).toFixed(2);
  const totalSizeMB = (stats.totalBytes / (1024 * 1024)).toFixed(2);

  console.log(`\n${'='.repeat(60)}`);
  console.log('Download Complete');
  console.log('='.repeat(60));
  console.log(`Duration: ${durationSeconds}s`);
  console.log(`Total discovered: ${stats.discovered}`);
  console.log(`Successfully downloaded: ${stats.downloaded}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Total size: ${totalSizeMB} MB`);

  if (stats.failures && stats.failures.length > 0) {
    console.log('\nFailed Downloads:');
    stats.failures.slice(0, 10).forEach((failure: FailureRecord) => {
      const statusInfo = failure.statusCode ? ` (${failure.statusCode})` : '';
      console.log(`  - ${failure.url}${statusInfo}`);
      console.log(`    Error: ${failure.error}`);
    });

    if (stats.failures.length > 10) {
      console.log(`  ... and ${stats.failures.length - 10} more`);
    }
  }

  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Main entry point for the CLI application
 * Orchestrates the complete scraping workflow
 *
 * @param options - CLI options
 * @returns Promise that resolves when scraping is complete
 *
 * Validates: Requirements 12.2, 12.3
 */
export async function main(options: CLIOptions): Promise<void> {
  try {
    console.log('Website Scraper Downloader\n');

    // Validate URL format
    console.log('Validating URL...');
    const validation = validateUrl(options.url);
    if (!validation.valid) {
      throw new Error(`Invalid URL: ${validation.error}`);
    }

    const targetUrl = validation.normalizedUrl!;
    console.log(`Target: ${targetUrl}`);

    // Check if URL is reachable
    console.log('Checking connectivity...');
    const reachable = await isReachable(targetUrl);
    if (!reachable) {
      throw new Error(`Target URL is not reachable: ${targetUrl}`);
    }
    console.log('Connection successful\n');

    // Determine output directory
    const outputDir = options.output || path.join('./downloads', extractDomain(targetUrl));
    console.log(`Output directory: ${outputDir}`);

    // Create output directory if it doesn't exist (Requirement 12.3)
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create output directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Initialize scraper configuration with defaults
    const scraperOptions: ScraperOptions = {
      targetUrl,
      outputDir,
      maxDepth: options.maxDepth ?? null,
      includeSubdomains: options.includeSubdomains ?? false,
      timeout: 30000, // 30 seconds
      maxRetries: 3,
    };

    // Display configuration
    console.log(`Max depth: ${scraperOptions.maxDepth ?? 'unlimited'}`);
    console.log(`Include subdomains: ${scraperOptions.includeSubdomains}`);
    console.log('\nStarting download...\n');

    // Call scraper controller
    const result = await scrape(scraperOptions);

    // Generate and display final report
    displayReport(result.stats, result.duration);

    // Generate and save report to file
    const downloadReport: DownloadReport = {
      totalFiles: result.stats.discovered,
      successfulDownloads: result.stats.downloaded,
      failedDownloads: result.stats.failed,
      totalSize: result.stats.totalBytes,
      failures: result.stats.failures,
      duration: result.duration,
    };

    const reportText = generateReport(downloadReport);
    await saveReport(reportText, outputDir);
    console.log(`Report saved to: ${outputDir}/download-report.txt`);

    // Exit with appropriate code
    if (result.stats.failed > 0 && result.stats.downloaded === 0) {
      // All downloads failed
      process.exit(1);
    } else {
      // At least some downloads succeeded
      process.exit(0);
    }
  } catch (error) {
    // Handle top-level errors
    console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run main if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);

  // Show help if no arguments provided
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  try {
    const options = parseArguments(args);
    main(options).catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    printUsage();
    process.exit(1);
  }
}
