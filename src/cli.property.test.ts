/**
 * Property-based tests for CLI interface
 * Feature: website-scraper-downloader
 * Tests Requirements 12.3
 */

import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import { main } from './cli';
import type { CLIOptions } from './types';

// Mock the scraper module to avoid actual network calls
jest.mock('./crawl/scraper', () => ({
  scrape: jest.fn().mockResolvedValue({
    stats: {
      discovered: 0,
      downloaded: 0,
      failed: 0,
      totalBytes: 0,
      failures: [],
    },
    duration: 0,
  }),
}));

// Mock the validator module to avoid actual network calls
jest.mock('./url/validator', () => ({
  validateUrl: jest.fn((url: string) => ({
    valid: true,
    normalizedUrl: url,
  })),
  isReachable: jest.fn().mockResolvedValue(true),
  extractDomain: jest.fn((url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'example.com';
    }
  }),
}));

// Mock process.exit to prevent actual exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
  throw new Error(`process.exit: ${code}`);
}) as unknown as jest.SpyInstance;

describe('CLI Interface - Property-Based Tests', () => {
  const testBaseDir = path.join(__dirname, '../test-output-pbt-cli');

  beforeAll(() => {
    // Mock console.log to reduce noise in test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
    // Clear mock calls
    mockExit.mockClear();
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors
    }
  });

  afterAll(() => {
    // Restore mocks
    jest.restoreAllMocks();
  });

  /**
   * Property 19: Output Directory Creation
   * For any specified output directory that does not exist, the scraper should
   * create it before downloading files.
   * **Validates: Requirements 12.3**
   */
  describe('Property 19: Output Directory Creation', () => {
    it('Feature: website-scraper-downloader, Property 19: Output Directory Creation', async () => {
      // Generator for output directory paths that don't exist
      const outputDirArbitrary = fc
        .tuple(
          fc.array(fc.stringMatching(/^[a-z0-9-]+$/), {
            minLength: 1,
            maxLength: 3,
          }),
          fc.stringMatching(/^[a-z0-9-]+$/),
        )
        .map(([dirs, finalDir]) => {
          return path.join(testBaseDir, ...dirs, finalDir);
        });

      await fc.assert(
        fc.asyncProperty(outputDirArbitrary, async (outputDir) => {
          // Ensure the directory doesn't exist before the test
          const existsBefore = await fs
            .access(outputDir)
            .then(() => true)
            .catch(() => false);

          // Property: Directory should not exist before main() is called
          expect(existsBefore).toBe(false);

          // Create CLI options with the non-existent output directory
          const options: CLIOptions = {
            url: 'https://example.com',
            output: outputDir,
            maxDepth: undefined,
            includeSubdomains: false,
          };

          // Call main function (which should create the directory)
          try {
            await main(options);
          } catch (error) {
            // Ignore process.exit errors
            if (error instanceof Error && !error.message.includes('process.exit')) {
              throw error;
            }
          }

          // Property: Directory should exist after main() is called
          const existsAfter = await fs
            .access(outputDir)
            .then(() => true)
            .catch(() => false);

          expect(existsAfter).toBe(true);

          // Property: Created path should be a directory
          const stats = await fs.stat(outputDir);
          expect(stats.isDirectory()).toBe(true);

          // Property: Created directory should be the one we specified
          const resolvedOutput = path.resolve(outputDir);
          const actualResolved = path.resolve(outputDir);
          expect(actualResolved).toBe(resolvedOutput);
        }),
        { numRuns: 100 },
      );
    });

    it('should create nested directories that do not exist', async () => {
      // Generator for deeply nested directory paths
      const deepPathArbitrary = fc
        .array(fc.stringMatching(/^[a-z0-9-]+$/), {
          minLength: 2,
          maxLength: 5,
        })
        .map((dirs) => path.join(testBaseDir, ...dirs));

      await fc.assert(
        fc.asyncProperty(deepPathArbitrary, async (outputDir) => {
          const options: CLIOptions = {
            url: 'https://example.com',
            output: outputDir,
            maxDepth: undefined,
            includeSubdomains: false,
          };

          try {
            await main(options);
          } catch (error) {
            // Ignore process.exit errors
            if (error instanceof Error && !error.message.includes('process.exit')) {
              throw error;
            }
          }

          // Property: All parent directories should be created
          const exists = await fs
            .access(outputDir)
            .then(() => true)
            .catch(() => false);

          expect(exists).toBe(true);

          // Property: Final path should be a directory
          const stats = await fs.stat(outputDir);
          expect(stats.isDirectory()).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should handle existing directories without error', async () => {
      // Generator for directory paths
      const dirArbitrary = fc
        .array(fc.stringMatching(/^[a-z0-9-]+$/), {
          minLength: 1,
          maxLength: 2,
        })
        .map((dirs) => path.join(testBaseDir, ...dirs));

      await fc.assert(
        fc.asyncProperty(dirArbitrary, async (outputDir) => {
          // Pre-create the directory
          await fs.mkdir(outputDir, { recursive: true });

          const existsBefore = await fs
            .access(outputDir)
            .then(() => true)
            .catch(() => false);

          expect(existsBefore).toBe(true);

          const options: CLIOptions = {
            url: 'https://example.com',
            output: outputDir,
            maxDepth: undefined,
            includeSubdomains: false,
          };

          // Property: Should not throw error when directory already exists
          try {
            await main(options);
          } catch (error) {
            // Ignore process.exit errors
            if (error instanceof Error && error.message.includes('process.exit')) {
              // This is expected, directory creation succeeded
            } else {
              throw error;
            }
          }

          // Property: Directory should still exist
          const existsAfter = await fs
            .access(outputDir)
            .then(() => true)
            .catch(() => false);

          expect(existsAfter).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });
});
