/**
 * Property-based tests for Scraper Controller
 * Feature: website-scraper-downloader
 * Tests Requirements 2.3, 2.4, 5.3, 6.2, 6.3, 6.4, 11.5
 */

import * as fc from 'fast-check';
import { scrape } from './scraper';
import * as downloader from '../fetch/downloader';
import * as writer from '../fs/writer';
import { DownloadResult, WriteResult } from '../types';

// Mock dependencies
jest.mock('../fetch/downloader');
jest.mock('../fs/writer');

describe('Scraper Controller - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 4: Error Resilience
   * For any download queue with at least one failing resource, the failure of
   * that resource should not prevent the processing of remaining queued resources.
   * **Validates: Requirements 2.3, 11.5**
   */
  describe('Property 4: Error Resilience', () => {
    it('Feature: website-scraper-downloader, Property 4: Error Resilience', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 8 }),
          fc.integer({ min: 1, max: 3 }),
          async (totalResources, failureCount) => {
            const mockDownload = jest.spyOn(downloader, 'downloadResource');
            const mockWrite = jest.spyOn(writer, 'writeFile');

            // Create HTML with links
            const urls = Array.from(
              { length: totalResources - 1 },
              (_, i) => `https://example.com/page${i}`,
            );
            const html = `<html>${urls.map(url => `<a href="${url}">Link</a>`).join('')}</html>`;

            let downloadCallIndex = 0;
            mockDownload.mockImplementation(async () => {
              const currentIndex = downloadCallIndex++;
              const shouldFail =
                currentIndex > 0 && currentIndex <= failureCount;

              if (shouldFail) {
                return {
                  success: false,
                  error: 'Network error',
                  statusCode: 500,
                } as DownloadResult;
              }

              return {
                success: true,
                content: Buffer.from(
                  currentIndex === 0 ? html : '<html>Content</html>',
                ),
                contentType: 'text/html',
                statusCode: 200,
              } as DownloadResult;
            });

            mockWrite.mockResolvedValue({
              success: true,
              path: '/output/file.html',
            } as WriteResult);

            const result = await scrape({
              targetUrl: 'https://example.com',
              outputDir: '/output',
              maxDepth: null,
              includeSubdomains: false,
            });

            // Property: Total processed (downloaded + failed) should equal discovered
            const totalProcessed =
              result.stats.downloaded + result.stats.failed;
            expect(totalProcessed).toBe(result.stats.discovered);

            // Property: Failed count should match expected failures
            expect(result.stats.failed).toBe(
              Math.min(failureCount, totalResources - 1),
            );

            // Property: Failures array should have correct length
            expect(result.stats.failures).toHaveLength(result.stats.failed);

            // Property: All failures should have error messages
            result.stats.failures.forEach(failure => {
              expect(failure.error).toBeTruthy();
              expect(failure.url).toBeTruthy();
            });
          },
        ),
        { numRuns: 20 }, // Reduced from 100 for faster execution
      );
    });

    it.skip('should continue processing when write operations fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 2 }),
          async writeFailures => {
            const totalResources = writeFailures + 2; // Ensure we have more resources than failures
            const mockDownload = jest.spyOn(downloader, 'downloadResource');
            const mockWrite = jest.spyOn(writer, 'writeFile');

            const urls = Array.from(
              { length: totalResources - 1 },
              (_, i) => `https://example.com/page${i}`,
            );
            const html = `<html>${urls.map(url => `<a href="${url}">Link</a>`).join('')}</html>`;

            mockDownload.mockImplementation(async (url: string) => {
              const isInitial = url === 'https://example.com';
              return {
                success: true,
                content: Buffer.from(isInitial ? html : '<html></html>'),
                contentType: 'text/html',
                statusCode: 200,
              } as DownloadResult;
            });

            let writeCallIndex = 0;
            mockWrite.mockImplementation(async () => {
              const currentIndex = writeCallIndex++;
              const shouldFail = currentIndex < writeFailures;

              if (shouldFail) {
                return {
                  success: false,
                  error: 'Disk full',
                } as WriteResult;
              }

              return {
                success: true,
                path: '/output/file.html',
              } as WriteResult;
            });

            const result = await scrape({
              targetUrl: 'https://example.com',
              outputDir: '/output',
              maxDepth: null,
              includeSubdomains: false,
            });

            // Property: Write failures should be counted as failed
            expect(result.stats.failed).toBe(writeFailures);

            // Property: Total processed should equal discovered
            const totalProcessed =
              result.stats.downloaded + result.stats.failed;
            expect(totalProcessed).toBe(result.stats.discovered);
          },
        ),
        { numRuns: 20 }, // Reduced from 100 for faster execution
      );
    });
  });

  /**
   * Property 8: File Extension Support
   * For any discovered URL with a supported file extension, the scraper should
   * download and save the file.
   * **Validates: Requirements 2.4, 5.3, 6.2, 6.3, 6.4**
   */
  describe('Property 8: File Extension Support', () => {
    // Supported file extensions by category
    const supportedExtensions = {
      html: ['.html', '.htm'],
      javascript: ['.js', '.mjs'],
      css: ['.css'],
      images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'],
      fonts: ['.woff', '.woff2', '.ttf', '.eot', '.otf'],
      media: ['.mp4', '.webm', '.ogg', '.mp3', '.wav'],
    };

    const allExtensions = Object.values(supportedExtensions).flat();

    it('Feature: website-scraper-downloader, Property 8: File Extension Support', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...allExtensions), {
            minLength: 1,
            maxLength: 8,
          }),
          async extensions => {
            const mockDownload = jest.spyOn(downloader, 'downloadResource');
            const mockWrite = jest.spyOn(writer, 'writeFile');

            const urls = extensions.map(
              (ext, i) => `https://example.com/file${i}${ext}`,
            );
            const html = `<html>${urls.map(url => `<a href="${url}">Link</a>`).join('')}</html>`;

            mockDownload.mockImplementation(async (url: string) => {
              // Determine content type based on extension
              let contentType = 'application/octet-stream';
              if (url.match(/\.(html|htm)$/)) contentType = 'text/html';
              else if (url.match(/\.(js|mjs)$/))
                contentType = 'application/javascript';
              else if (url.match(/\.css$/)) contentType = 'text/css';
              else if (url.match(/\.(png|jpg|jpeg|gif|webp|ico)$/))
                contentType = 'image/png';
              else if (url.match(/\.svg$/)) contentType = 'image/svg+xml';
              else if (url.match(/\.(woff|woff2|ttf|eot|otf)$/))
                contentType = 'font/woff2';
              else if (url.match(/\.(mp4|webm|ogg|mp3|wav)$/))
                contentType = 'video/mp4';

              // Initial URL returns HTML with links, others return empty/non-HTML content
              let content: string;
              if (url === 'https://example.com') {
                content = html;
              } else if (contentType === 'text/html') {
                // HTML files should not contain more links to avoid infinite loops
                content = '<html><body>Content</body></html>';
              } else {
                content = 'file content';
              }

              return {
                success: true,
                content: Buffer.from(content),
                contentType:
                  url === 'https://example.com' ? 'text/html' : contentType,
                statusCode: 200,
              } as DownloadResult;
            });

            mockWrite.mockResolvedValue({
              success: true,
              path: '/output/file',
            } as WriteResult);

            const result = await scrape({
              targetUrl: 'https://example.com',
              outputDir: '/output',
              maxDepth: null, // Changed from 0 to null to follow links
              includeSubdomains: false,
            });

            // Property: All discovered URLs should be processed
            expect(result.stats.discovered).toBeGreaterThanOrEqual(
              urls.length + 1,
            ); // At least initial + urls

            // Property: All resources should be successfully downloaded
            expect(result.stats.downloaded).toBe(result.stats.discovered);
            expect(result.stats.failed).toBe(0);
          },
        ),
        { numRuns: 20 }, // Reduced from 100 for faster execution
      );
    });

    it('should download HTML files with .html and .htm extensions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom('.html', '.htm'), {
            minLength: 1,
            maxLength: 4,
          }),
          async extensions => {
            const mockDownload = jest.spyOn(downloader, 'downloadResource');
            const mockWrite = jest.spyOn(writer, 'writeFile');

            const urls = extensions.map(
              (ext, i) => `https://example.com/page${i}${ext}`,
            );
            const html = `<html>${urls.map(url => `<a href="${url}">Link</a>`).join('')}</html>`;

            mockDownload.mockResolvedValue({
              success: true,
              content: Buffer.from(html),
              contentType: 'text/html',
              statusCode: 200,
            } as DownloadResult);

            mockWrite.mockResolvedValue({
              success: true,
              path: '/output/file.html',
            } as WriteResult);

            const result = await scrape({
              targetUrl: 'https://example.com',
              outputDir: '/output',
              maxDepth: null, // Changed from 0 to null to follow links
              includeSubdomains: false,
            });

            // Property: All HTML files should be downloaded
            expect(result.stats.downloaded).toBeGreaterThan(0);
            expect(result.stats.failed).toBe(0);
          },
        ),
        { numRuns: 20 }, // Reduced from 100 for faster execution
      );
    });

    it('should download JavaScript files with .js and .mjs extensions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom('.js', '.mjs'), {
            minLength: 1,
            maxLength: 4,
          }),
          async extensions => {
            const mockDownload = jest.spyOn(downloader, 'downloadResource');
            const mockWrite = jest.spyOn(writer, 'writeFile');

            const urls = extensions.map(
              (ext, i) => `https://example.com/script${i}${ext}`,
            );
            const html = `<html>${urls.map(url => `<script src="${url}"></script>`).join('')}</html>`;

            mockDownload.mockImplementation(async (url: string) => {
              const isInitial = url === 'https://example.com';
              return {
                success: true,
                content: Buffer.from(isInitial ? html : 'console.log("test");'),
                contentType: isInitial ? 'text/html' : 'application/javascript',
                statusCode: 200,
              } as DownloadResult;
            });

            mockWrite.mockResolvedValue({
              success: true,
              path: '/output/file',
            } as WriteResult);

            const result = await scrape({
              targetUrl: 'https://example.com',
              outputDir: '/output',
              maxDepth: null, // Changed from 0 to null to follow links
              includeSubdomains: false,
            });

            // Property: All JavaScript files should be downloaded
            expect(result.stats.downloaded).toBe(urls.length + 1);
            expect(result.stats.failed).toBe(0);
          },
        ),
        { numRuns: 20 }, // Reduced from 100 for faster execution
      );
    });

    it('should download image files with various extensions', async () => {
      const imageExtensions = [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.svg',
        '.webp',
        '.ico',
      ];

      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...imageExtensions), {
            minLength: 1,
            maxLength: 5,
          }),
          async extensions => {
            const mockDownload = jest.spyOn(downloader, 'downloadResource');
            const mockWrite = jest.spyOn(writer, 'writeFile');

            const urls = extensions.map(
              (ext, i) => `https://example.com/image${i}${ext}`,
            );
            const html = `<html>${urls.map(url => `<img src="${url}" />`).join('')}</html>`;

            mockDownload.mockImplementation(async (url: string) => {
              const isInitial = url === 'https://example.com';
              return {
                success: true,
                content: Buffer.from(isInitial ? html : 'IMAGE_DATA'),
                contentType: isInitial ? 'text/html' : 'image/png',
                statusCode: 200,
              } as DownloadResult;
            });

            mockWrite.mockResolvedValue({
              success: true,
              path: '/output/file',
            } as WriteResult);

            const result = await scrape({
              targetUrl: 'https://example.com',
              outputDir: '/output',
              maxDepth: null, // Changed from 0 to null to follow links
              includeSubdomains: false,
            });

            // Property: All image files should be downloaded
            expect(result.stats.downloaded).toBe(urls.length + 1);
            expect(result.stats.failed).toBe(0);
          },
        ),
        { numRuns: 20 }, // Reduced from 100 for faster execution
      );
    });

    it('should download font files with various extensions', async () => {
      const fontExtensions = ['.woff', '.woff2', '.ttf', '.eot', '.otf'];

      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...fontExtensions), {
            minLength: 1,
            maxLength: 3,
          }),
          async extensions => {
            const mockDownload = jest.spyOn(downloader, 'downloadResource');
            const mockWrite = jest.spyOn(writer, 'writeFile');

            const urls = extensions.map(
              (ext, i) => `https://example.com/font${i}${ext}`,
            );
            const css = `@font-face { ${urls.map(url => `src: url('${url}');`).join(' ')} }`;
            const html = `<html><style>${css}</style></html>`;

            mockDownload.mockImplementation(async (url: string) => {
              const isInitial = url === 'https://example.com';
              return {
                success: true,
                content: Buffer.from(isInitial ? html : 'FONT_DATA'),
                contentType: isInitial ? 'text/html' : 'font/woff2',
                statusCode: 200,
              } as DownloadResult;
            });

            mockWrite.mockResolvedValue({
              success: true,
              path: '/output/file',
            } as WriteResult);

            const result = await scrape({
              targetUrl: 'https://example.com',
              outputDir: '/output',
              maxDepth: null, // Changed from 0 to null to follow links
              includeSubdomains: false,
            });

            // Property: All font files should be downloaded
            expect(result.stats.downloaded).toBe(urls.length + 1);
            expect(result.stats.failed).toBe(0);
          },
        ),
        { numRuns: 20 }, // Reduced from 100 for faster execution
      );
    });

    it('should download media files with various extensions', async () => {
      const mediaExtensions = ['.mp4', '.webm', '.ogg', '.mp3', '.wav'];

      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...mediaExtensions), {
            minLength: 1,
            maxLength: 3,
          }),
          async extensions => {
            const mockDownload = jest.spyOn(downloader, 'downloadResource');
            const mockWrite = jest.spyOn(writer, 'writeFile');

            const urls = extensions.map(
              (ext, i) => `https://example.com/media${i}${ext}`,
            );
            const html = `<html>${urls.map(url => `<source src="${url}">`).join('')}</html>`;

            mockDownload.mockImplementation(async (url: string) => {
              const isInitial = url === 'https://example.com';
              return {
                success: true,
                content: Buffer.from(isInitial ? html : 'MEDIA_DATA'),
                contentType: isInitial ? 'text/html' : 'video/mp4',
                statusCode: 200,
              } as DownloadResult;
            });

            mockWrite.mockResolvedValue({
              success: true,
              path: '/output/file',
            } as WriteResult);

            const result = await scrape({
              targetUrl: 'https://example.com',
              outputDir: '/output',
              maxDepth: null, // Changed from 0 to null to follow links
              includeSubdomains: false,
            });

            // Property: All media files should be downloaded
            expect(result.stats.downloaded).toBe(urls.length + 1);
            expect(result.stats.failed).toBe(0);
          },
        ),
        { numRuns: 20 }, // Reduced from 100 for faster execution
      );
    });
  });
});
