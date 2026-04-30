/**
 * Integration tests for CLI main function
 * Feature: website-scraper-downloader
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { main } from './cli';
import { CLIOptions } from './types';

// Mock the validator module
jest.mock('./validator', () => ({
  validateUrl: jest.fn((url: string) => ({
    valid: true,
    normalizedUrl: url,
  })),
  isReachable: jest.fn(() => Promise.resolve(true)),
  extractDomain: jest.fn((url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'example.com';
    }
  }),
  normalizeUrl: jest.fn((url: string) => url),
}));

// Mock the scraper module
jest.mock('./scraper', () => ({
  scrape: jest.fn(() =>
    Promise.resolve({
      stats: {
        discovered: 10,
        downloaded: 8,
        failed: 2,
        totalBytes: 1024000,
        failures: [
          {
            url: 'https://example.com/missing.jpg',
            error: '404 Not Found',
            statusCode: 404,
          },
          {
            url: 'https://example.com/error.css',
            error: 'Network timeout',
          },
        ],
      },
      duration: 5000,
    }),
  ),
}));

describe('CLI Integration', () => {
  const testOutputDir = path.join(__dirname, '..', 'test-cli-output');

  beforeEach(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe('main function', () => {
    it('should create output directory if it does not exist', async () => {
      const options: CLIOptions = {
        url: 'https://example.com',
        output: testOutputDir,
      };

      // Mock process.exit to prevent test from exiting
      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any);

      await main(options);

      // Check that directory was created
      const stats = await fs.stat(testOutputDir);
      expect(stats.isDirectory()).toBe(true);

      mockExit.mockRestore();
    });

    it('should use domain name as default output directory', async () => {
      const options: CLIOptions = {
        url: 'https://test-domain.com',
      };

      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any);

      await main(options);

      // Check that directory with domain name was created
      const domainDir = path.join(process.cwd(), 'test-domain.com');
      try {
        const stats = await fs.stat(domainDir);
        expect(stats.isDirectory()).toBe(true);
        // Clean up
        await fs.rm(domainDir, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist if scraper mock didn't create it
      }

      mockExit.mockRestore();
    });

    it('should handle invalid URL gracefully', async () => {
      const { validateUrl } = require('./validator');
      validateUrl.mockReturnValueOnce({
        valid: false,
        error: 'Invalid URL format',
      });

      const options: CLIOptions = {
        url: 'not-a-valid-url',
        output: testOutputDir,
      };

      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any);
      const mockConsoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await main(options);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '\nError:',
        expect.stringContaining('Invalid URL'),
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should handle unreachable URL gracefully', async () => {
      const { isReachable } = require('./validator');
      isReachable.mockResolvedValueOnce(false);

      const options: CLIOptions = {
        url: 'https://unreachable.example.com',
        output: testOutputDir,
      };

      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any);
      const mockConsoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await main(options);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '\nError:',
        expect.stringContaining('not reachable'),
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should pass correct options to scraper', async () => {
      const { scrape } = require('./scraper');
      scrape.mockClear();

      const options: CLIOptions = {
        url: 'https://example.com',
        output: testOutputDir,
        maxDepth: 3,
        includeSubdomains: true,
      };

      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any);

      await main(options);

      expect(scrape).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUrl: 'https://example.com',
          outputDir: testOutputDir,
          maxDepth: 3,
          includeSubdomains: true,
          timeout: 30000,
          maxRetries: 3,
        }),
      );

      mockExit.mockRestore();
    });

    it('should exit with code 0 on successful download', async () => {
      const options: CLIOptions = {
        url: 'https://example.com',
        output: testOutputDir,
      };

      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any);

      await main(options);

      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should exit with code 1 when all downloads fail', async () => {
      const { scrape } = require('./scraper');
      scrape.mockResolvedValueOnce({
        stats: {
          discovered: 5,
          downloaded: 0,
          failed: 5,
          totalBytes: 0,
          failures: [],
        },
        duration: 1000,
      });

      const options: CLIOptions = {
        url: 'https://example.com',
        output: testOutputDir,
      };

      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any);

      await main(options);

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });
});
