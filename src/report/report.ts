/**
 * Report generator for download sessions
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DownloadReport } from '../types';

/**
 * Generates a formatted text report from download statistics
 *
 * @param report - Download report data
 * @returns Formatted report string
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4
 */
export function generateReport(report: DownloadReport): string {
  const lines: string[] = [];

  // Header
  lines.push('='.repeat(70));
  lines.push('Website Scraper Download Report');
  lines.push('='.repeat(70));
  lines.push('');

  // Summary statistics
  lines.push('Summary:');
  lines.push(`  Total files discovered: ${report.totalFiles}`);
  lines.push(`  Successfully downloaded: ${report.successfulDownloads}`);
  lines.push(`  Failed downloads: ${report.failedDownloads}`);
  lines.push('');

  // Size information
  const sizeMB = (report.totalSize / (1024 * 1024)).toFixed(2);
  const sizeKB = (report.totalSize / 1024).toFixed(2);
  const sizeDisplay =
    report.totalSize >= 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
  lines.push(`  Total size: ${sizeDisplay} (${report.totalSize} bytes)`);
  lines.push('');

  // Duration
  const durationSeconds = (report.duration / 1000).toFixed(2);
  const durationMinutes = (report.duration / 60000).toFixed(2);
  const durationDisplay =
    report.duration >= 60000
      ? `${durationMinutes} minutes`
      : `${durationSeconds} seconds`;
  lines.push(`  Duration: ${durationDisplay}`);
  lines.push('');

  // Failed downloads section
  if (report.failures.length > 0) {
    lines.push('Failed Downloads:');
    lines.push('-'.repeat(70));

    report.failures.forEach((failure, index) => {
      lines.push(`${index + 1}. ${failure.url}`);
      if (failure.statusCode) {
        lines.push(`   Status Code: ${failure.statusCode}`);
      }
      lines.push(`   Error: ${failure.error}`);
      lines.push('');
    });
  } else {
    lines.push('All downloads completed successfully!');
    lines.push('');
  }

  // Footer
  lines.push('='.repeat(70));
  lines.push(`Report generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(70));

  return lines.join('\n');
}

/**
 * Saves a report string to a file in the output directory
 *
 * @param report - Formatted report string
 * @param outputDir - Output directory path
 * @returns Promise that resolves when report is saved
 * @throws Error if unable to write report file
 *
 * Validates: Requirements 15.5
 */
export async function saveReport(
  report: string,
  outputDir: string,
): Promise<void> {
  const reportPath = path.join(outputDir, 'download-report.txt');

  try {
    await fs.writeFile(reportPath, report, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to save report: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
