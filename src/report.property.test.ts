/**
 * Property-based tests for Report Generator
 * Feature: website-scraper-downloader
 * Tests Requirements 15.1, 15.2, 15.3, 15.4, 15.5
 */

import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import { generateReport, saveReport } from './report';
import { DownloadReport, FailureRecord } from './types';

describe('Report Generator - Property-Based Tests', () => {
  /**
   * Property 25: Report Generation
   * For any completed download session, a report should be generated containing
   * total files downloaded, total size, and failure records.
   * **Validates: Requirements 15.1, 15.2, 15.3, 15.4**
   */
  describe('Property 25: Report Generation', () => {
    it('Feature: website-scraper-downloader, Property 25: Report Generation', () => {
      // Generator for FailureRecord
      const failureRecordArbitrary = fc.record({
        url: fc.webUrl({ validSchemes: ['http', 'https'] }),
        error: fc.string({ minLength: 1, maxLength: 200 }),
        statusCode: fc.option(fc.integer({ min: 100, max: 599 }), {
          nil: undefined,
        }),
      });

      // Generator for DownloadReport
      const downloadReportArbitrary = fc
        .record({
          totalFiles: fc.nat({ max: 10000 }),
          successfulDownloads: fc.nat({ max: 10000 }),
          failedDownloads: fc.nat({ max: 1000 }),
          totalSize: fc.nat({ max: 1024 * 1024 * 1024 }), // Up to 1GB
          failures: fc.array(failureRecordArbitrary, { maxLength: 100 }),
          duration: fc.nat({ max: 3600000 }), // Up to 1 hour
        })
        .filter(report => {
          // Ensure consistency: totalFiles = successfulDownloads + failedDownloads
          return (
            report.totalFiles ===
            report.successfulDownloads + report.failedDownloads
          );
        })
        .filter(report => {
          // Ensure failures array length matches failedDownloads count
          return report.failures.length === report.failedDownloads;
        });

      fc.assert(
        fc.property(downloadReportArbitrary, report => {
          const result = generateReport(report);

          // Property: Report must be a non-empty string
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);

          // Property: Report must contain total files (Requirement 15.2)
          expect(result).toContain(
            `Total files discovered: ${report.totalFiles}`,
          );

          // Property: Report must contain successful downloads count
          expect(result).toContain(
            `Successfully downloaded: ${report.successfulDownloads}`,
          );

          // Property: Report must contain failed downloads count
          expect(result).toContain(
            `Failed downloads: ${report.failedDownloads}`,
          );

          // Property: Report must contain total size (Requirement 15.3)
          expect(result).toContain('Total size:');
          expect(result).toContain(`${report.totalSize} bytes`);

          // Property: Report must contain duration
          expect(result).toContain('Duration:');

          // Property: Report must contain all failure records (Requirement 15.4)
          report.failures.forEach(failure => {
            expect(result).toContain(failure.url);
            expect(result).toContain(failure.error);
            if (failure.statusCode !== undefined) {
              expect(result).toContain(`Status Code: ${failure.statusCode}`);
            }
          });

          // Property: Report must contain timestamp
          expect(result).toMatch(/Report generated: \d{4}-\d{2}-\d{2}T/);

          // Property: Report must contain header
          expect(result).toContain('Website Scraper Download Report');
        }),
        { numRuns: 50 },
      );
    });

    it('should generate consistent reports for the same input', () => {
      fc.assert(
        fc.property(
          fc.record({
            totalFiles: fc.nat({ max: 1000 }),
            successfulDownloads: fc.nat({ max: 1000 }),
            failedDownloads: fc.nat({ max: 100 }),
            totalSize: fc.nat({ max: 1024 * 1024 * 100 }),
            failures: fc.array(
              fc.record({
                url: fc.webUrl({ validSchemes: ['http', 'https'] }),
                error: fc.string({ minLength: 1, maxLength: 100 }),
                statusCode: fc.option(fc.integer({ min: 100, max: 599 }), {
                  nil: undefined,
                }),
              }),
              { maxLength: 10 },
            ),
            duration: fc.nat({ max: 600000 }),
          }),
          report => {
            // Generate report twice with same input
            const result1 = generateReport(report);
            const result2 = generateReport(report);

            // Property: Same input should produce same output (except timestamp)
            // We'll check that the structure is the same by comparing key elements
            const extractStats = (text: string) => {
              const totalMatch = text.match(/Total files discovered: (\d+)/);
              const successMatch = text.match(/Successfully downloaded: (\d+)/);
              const failedMatch = text.match(/Failed downloads: (\d+)/);
              return {
                total: totalMatch ? totalMatch[1] : null,
                success: successMatch ? successMatch[1] : null,
                failed: failedMatch ? failedMatch[1] : null,
              };
            };

            const stats1 = extractStats(result1);
            const stats2 = extractStats(result2);

            expect(stats1).toEqual(stats2);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should handle edge case with zero downloads', () => {
      fc.assert(
        fc.property(fc.nat({ max: 100000 }), duration => {
          const report: DownloadReport = {
            totalFiles: 0,
            successfulDownloads: 0,
            failedDownloads: 0,
            totalSize: 0,
            failures: [],
            duration,
          };

          const result = generateReport(report);

          // Property: Report should handle zero values gracefully
          expect(result).toContain('Total files discovered: 0');
          expect(result).toContain('Successfully downloaded: 0');
          expect(result).toContain('Failed downloads: 0');
          expect(result).toContain('All downloads completed successfully!');
        }),
        { numRuns: 30 },
      );
    });

    it('should handle edge case with all failures', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.nat({ max: 600000 }),
          (failureCount, duration) => {
            const failures: FailureRecord[] = Array.from(
              { length: failureCount },
              (_, i) => ({
                url: `https://example.com/file${i}.html`,
                error: `Error ${i}`,
                statusCode: 404,
              }),
            );

            const report: DownloadReport = {
              totalFiles: failureCount,
              successfulDownloads: 0,
              failedDownloads: failureCount,
              totalSize: 0,
              failures,
              duration,
            };

            const result = generateReport(report);

            // Property: Report should list all failures
            expect(result).toContain('Failed Downloads:');
            failures.forEach(failure => {
              expect(result).toContain(failure.url);
              expect(result).toContain(failure.error);
            });
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should format size correctly for various magnitudes', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.nat({ max: 1024 }), // Bytes
            fc.integer({ min: 1024, max: 1024 * 1024 }), // KB range
            fc.integer({ min: 1024 * 1024, max: 1024 * 1024 * 1024 }), // MB range
          ),
          totalSize => {
            const report: DownloadReport = {
              totalFiles: 10,
              successfulDownloads: 10,
              failedDownloads: 0,
              totalSize,
              failures: [],
              duration: 10000,
            };

            const result = generateReport(report);

            // Property: Size should be formatted with appropriate unit
            if (totalSize >= 1024 * 1024) {
              expect(result).toMatch(/\d+\.\d+ MB/);
            } else {
              expect(result).toMatch(/\d+\.\d+ KB/);
            }

            // Property: Byte count should always be present
            expect(result).toContain(`${totalSize} bytes`);
          },
        ),
        { numRuns: 40 },
      );
    });

    it('should format duration correctly for various magnitudes', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.nat({ max: 60000 }), // Under 1 minute
            fc.integer({ min: 60000, max: 3600000 }), // 1 minute to 1 hour
          ),
          duration => {
            const report: DownloadReport = {
              totalFiles: 10,
              successfulDownloads: 10,
              failedDownloads: 0,
              totalSize: 1024,
              failures: [],
              duration,
            };

            const result = generateReport(report);

            // Property: Duration should be formatted with appropriate unit
            if (duration >= 60000) {
              expect(result).toMatch(/\d+\.\d+ minutes/);
            } else {
              expect(result).toMatch(/\d+\.\d+ seconds/);
            }
          },
        ),
        { numRuns: 40 },
      );
    });
  });

  /**
   * Property 26: Report Persistence
   * For any completed download session, the report file should exist in the output directory.
   * **Validates: Requirements 15.5**
   */
  describe('Property 26: Report Persistence', () => {
    const testOutputBase = path.join(__dirname, '..', 'test-output-pbt');

    beforeAll(async () => {
      await fs.mkdir(testOutputBase, { recursive: true });
    });

    afterAll(async () => {
      try {
        await fs.rm(testOutputBase, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('Feature: website-scraper-downloader, Property 26: Report Persistence', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
            // Filter out strings with invalid path characters
            return !/[<>:"|?*\x00-\x1f]/.test(s) && s !== '.' && s !== '..';
          }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          async (dirName, reportContent) => {
            const outputDir = path.join(testOutputBase, dirName);

            // Create output directory
            await fs.mkdir(outputDir, { recursive: true });

            // Save report
            await saveReport(reportContent, outputDir);

            // Property: Report file must exist (Requirement 15.5)
            const reportPath = path.join(outputDir, 'download-report.txt');
            const exists = await fs
              .access(reportPath)
              .then(() => true)
              .catch(() => false);
            expect(exists).toBe(true);

            // Property: Report file must contain the exact content
            const savedContent = await fs.readFile(reportPath, 'utf-8');
            expect(savedContent).toBe(reportContent);

            // Property: Report file must be readable
            const stats = await fs.stat(reportPath);
            expect(stats.isFile()).toBe(true);
            expect(stats.size).toBe(Buffer.byteLength(reportContent, 'utf-8'));
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should persist reports with special characters', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
            return !/[<>:"|?*\x00-\x1f]/.test(s) && s !== '.' && s !== '..';
          }),
          fc.string({ minLength: 0, maxLength: 5000 }),
          async (dirName, reportContent) => {
            const outputDir = path.join(testOutputBase, dirName);
            await fs.mkdir(outputDir, { recursive: true });

            await saveReport(reportContent, outputDir);

            const reportPath = path.join(outputDir, 'download-report.txt');
            const savedContent = await fs.readFile(reportPath, 'utf-8');

            // Property: Content with special characters should be preserved exactly
            expect(savedContent).toBe(reportContent);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should overwrite existing reports', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
            return !/[<>:"|?*\x00-\x1f]/.test(s) && s !== '.' && s !== '..';
          }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          async (dirName, firstContent, secondContent) => {
            const outputDir = path.join(testOutputBase, dirName);
            await fs.mkdir(outputDir, { recursive: true });

            // Save first report
            await saveReport(firstContent, outputDir);

            // Save second report (should overwrite)
            await saveReport(secondContent, outputDir);

            const reportPath = path.join(outputDir, 'download-report.txt');
            const savedContent = await fs.readFile(reportPath, 'utf-8');

            // Property: Second save should overwrite first
            expect(savedContent).toBe(secondContent);
            expect(savedContent).not.toBe(firstContent);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should handle empty reports', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
            return !/[<>:"|?*\x00-\x1f]/.test(s) && s !== '.' && s !== '..';
          }),
          async dirName => {
            const outputDir = path.join(testOutputBase, dirName);
            await fs.mkdir(outputDir, { recursive: true });

            const emptyReport = '';
            await saveReport(emptyReport, outputDir);

            const reportPath = path.join(outputDir, 'download-report.txt');
            const savedContent = await fs.readFile(reportPath, 'utf-8');

            // Property: Empty reports should be saved correctly
            expect(savedContent).toBe('');

            const stats = await fs.stat(reportPath);
            expect(stats.size).toBe(0);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should handle very large reports', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
            return !/[<>:"|?*\x00-\x1f]/.test(s) && s !== '.' && s !== '..';
          }),
          async dirName => {
            const outputDir = path.join(testOutputBase, dirName);
            await fs.mkdir(outputDir, { recursive: true });

            // Generate a large report (simulate many failures)
            const largeReport = 'x'.repeat(100000); // 100KB of data
            await saveReport(largeReport, outputDir);

            const reportPath = path.join(outputDir, 'download-report.txt');
            const savedContent = await fs.readFile(reportPath, 'utf-8');

            // Property: Large reports should be saved completely
            expect(savedContent.length).toBe(largeReport.length);
            expect(savedContent).toBe(largeReport);
          },
        ),
        { numRuns: 20 }, // Fewer runs for large data
      );
    });
  });
});
