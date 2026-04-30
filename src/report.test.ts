/**
 * Unit tests for report generator
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { generateReport, saveReport } from './report';
import { DownloadReport, FailureRecord } from './types';

describe('Report Generator', () => {
  describe('generateReport', () => {
    it('should generate report with all statistics', () => {
      const report: DownloadReport = {
        totalFiles: 100,
        successfulDownloads: 95,
        failedDownloads: 5,
        totalSize: 1024 * 1024 * 2.5, // 2.5 MB
        failures: [
          {
            url: 'https://example.com/missing.jpg',
            error: 'Not found',
            statusCode: 404,
          },
          {
            url: 'https://example.com/forbidden.css',
            error: 'Forbidden',
            statusCode: 403,
          },
        ],
        duration: 45000, // 45 seconds
      };

      const result = generateReport(report);

      expect(result).toContain('Website Scraper Download Report');
      expect(result).toContain('Total files discovered: 100');
      expect(result).toContain('Successfully downloaded: 95');
      expect(result).toContain('Failed downloads: 5');
      expect(result).toContain('2.50 MB');
      expect(result).toContain('45.00 seconds');
      expect(result).toContain('https://example.com/missing.jpg');
      expect(result).toContain('Status Code: 404');
      expect(result).toContain('Not found');
      expect(result).toContain('https://example.com/forbidden.css');
      expect(result).toContain('Status Code: 403');
      expect(result).toContain('Forbidden');
    });

    it('should handle zero failures', () => {
      const report: DownloadReport = {
        totalFiles: 50,
        successfulDownloads: 50,
        failedDownloads: 0,
        totalSize: 1024 * 500, // 500 KB
        failures: [],
        duration: 10000, // 10 seconds
      };

      const result = generateReport(report);

      expect(result).toContain('All downloads completed successfully!');
      expect(result).not.toContain('Failed Downloads:');
    });

    it('should format size in KB for small downloads', () => {
      const report: DownloadReport = {
        totalFiles: 10,
        successfulDownloads: 10,
        failedDownloads: 0,
        totalSize: 1024 * 50, // 50 KB
        failures: [],
        duration: 5000,
      };

      const result = generateReport(report);

      expect(result).toContain('50.00 KB');
    });

    it('should format duration in minutes for long sessions', () => {
      const report: DownloadReport = {
        totalFiles: 1000,
        successfulDownloads: 1000,
        failedDownloads: 0,
        totalSize: 1024 * 1024 * 100,
        failures: [],
        duration: 180000, // 3 minutes
      };

      const result = generateReport(report);

      expect(result).toContain('3.00 minutes');
    });

    it('should handle failures without status codes', () => {
      const report: DownloadReport = {
        totalFiles: 20,
        successfulDownloads: 18,
        failedDownloads: 2,
        totalSize: 1024 * 1024,
        failures: [
          {
            url: 'https://example.com/timeout.js',
            error: 'Connection timeout',
          },
        ],
        duration: 30000,
      };

      const result = generateReport(report);

      expect(result).toContain('https://example.com/timeout.js');
      expect(result).toContain('Connection timeout');
      expect(result).not.toContain('Status Code:');
    });

    it('should include timestamp in report', () => {
      const report: DownloadReport = {
        totalFiles: 1,
        successfulDownloads: 1,
        failedDownloads: 0,
        totalSize: 1024,
        failures: [],
        duration: 1000,
      };

      const result = generateReport(report);

      expect(result).toMatch(/Report generated: \d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('saveReport', () => {
    const testOutputDir = path.join(__dirname, '..', 'test-output-report');

    beforeEach(async () => {
      // Create test output directory
      await fs.mkdir(testOutputDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up test output directory
      try {
        await fs.rm(testOutputDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should save report to file', async () => {
      const reportText = 'Test report content';

      await saveReport(reportText, testOutputDir);

      const reportPath = path.join(testOutputDir, 'download-report.txt');
      const savedContent = await fs.readFile(reportPath, 'utf-8');

      expect(savedContent).toBe(reportText);
    });

    it('should overwrite existing report file', async () => {
      const reportPath = path.join(testOutputDir, 'download-report.txt');

      // Write initial report
      await saveReport('First report', testOutputDir);
      const firstContent = await fs.readFile(reportPath, 'utf-8');
      expect(firstContent).toBe('First report');

      // Overwrite with new report
      await saveReport('Second report', testOutputDir);
      const secondContent = await fs.readFile(reportPath, 'utf-8');
      expect(secondContent).toBe('Second report');
    });

    it('should throw error for invalid output directory', async () => {
      const invalidDir = '/invalid/nonexistent/path/that/does/not/exist';

      await expect(saveReport('Test', invalidDir)).rejects.toThrow(
        'Failed to save report',
      );
    });
  });
});
