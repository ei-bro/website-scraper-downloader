/**
 * Unit tests for scraper controller
 */

import * as downloader from '../fetch/downloader';
import * as writer from '../fs/writer';
import { scrape } from './scraper';

// Mock dependencies
jest.mock('../fetch/downloader');
jest.mock('../fs/writer');
jest.mock('fs/promises');

describe('Scraper Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scrape', () => {
    it('should download and save the initial URL', async () => {
      const mockDownload = jest.spyOn(downloader, 'downloadResource').mockResolvedValue({
        success: true,
        content: Buffer.from('<html></html>'),
        contentType: 'text/html',
        statusCode: 200,
      });

      const mockWrite = jest.spyOn(writer, 'writeFile').mockResolvedValue({
        success: true,
        path: '/output/index.html',
      });

      const result = await scrape({
        targetUrl: 'https://example.com',
        outputDir: '/output',
        maxDepth: null,
        includeSubdomains: false,
      });

      expect(mockDownload).toHaveBeenCalledWith('https://example.com', undefined, undefined);
      expect(mockWrite).toHaveBeenCalledWith(
        'https://example.com',
        Buffer.from('<html></html>'),
        '/output',
      );
      expect(result.stats.downloaded).toBe(1);
      expect(result.stats.failed).toBe(0);
    });

    it('should continue processing queue when a download fails', async () => {
      const mockDownload = jest
        .spyOn(downloader, 'downloadResource')
        .mockResolvedValueOnce({
          success: true,
          content: Buffer.from('<html><a href="https://example.com/page1">Link</a></html>'),
          contentType: 'text/html',
          statusCode: 200,
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Network error',
          statusCode: 500,
        });

      const mockWrite = jest.spyOn(writer, 'writeFile').mockResolvedValue({
        success: true,
        path: '/output/index.html',
      });

      const result = await scrape({
        targetUrl: 'https://example.com',
        outputDir: '/output',
        maxDepth: null,
        includeSubdomains: false,
      });

      expect(result.stats.downloaded).toBe(1);
      expect(result.stats.failed).toBe(1);
      expect(result.stats.failures).toHaveLength(1);
      expect(result.stats.failures[0].url).toBe('https://example.com/page1');
    });

    it('should continue processing queue when a write fails', async () => {
      const mockDownload = jest.spyOn(downloader, 'downloadResource').mockResolvedValue({
        success: true,
        content: Buffer.from('<html></html>'),
        contentType: 'text/html',
        statusCode: 200,
      });

      const mockWrite = jest.spyOn(writer, 'writeFile').mockResolvedValue({
        success: false,
        error: 'Disk full',
      });

      const result = await scrape({
        targetUrl: 'https://example.com',
        outputDir: '/output',
        maxDepth: null,
        includeSubdomains: false,
      });

      expect(result.stats.downloaded).toBe(0);
      expect(result.stats.failed).toBe(1);
      expect(result.stats.failures[0].error).toBe('Disk full');
    });

    it('should discover and queue links from HTML', async () => {
      const mockDownload = jest
        .spyOn(downloader, 'downloadResource')
        .mockResolvedValueOnce({
          success: true,
          content: Buffer.from('<html><a href="https://example.com/page1">Link</a></html>'),
          contentType: 'text/html',
          statusCode: 200,
        })
        .mockResolvedValueOnce({
          success: true,
          content: Buffer.from('<html>Page 1</html>'),
          contentType: 'text/html',
          statusCode: 200,
        });

      const mockWrite = jest.spyOn(writer, 'writeFile').mockResolvedValue({
        success: true,
        path: '/output/index.html',
      });

      const result = await scrape({
        targetUrl: 'https://example.com',
        outputDir: '/output',
        maxDepth: null,
        includeSubdomains: false,
      });

      expect(result.stats.discovered).toBe(2);
      expect(result.stats.downloaded).toBe(2);
    });

    it('should respect domain boundaries', async () => {
      const mockDownload = jest.spyOn(downloader, 'downloadResource').mockResolvedValueOnce({
        success: true,
        content: Buffer.from('<html><a href="https://other.com/page">Link</a></html>'),
        contentType: 'text/html',
        statusCode: 200,
      });

      const mockWrite = jest.spyOn(writer, 'writeFile').mockResolvedValue({
        success: true,
        path: '/output/index.html',
      });

      const result = await scrape({
        targetUrl: 'https://example.com',
        outputDir: '/output',
        maxDepth: null,
        includeSubdomains: false,
      });

      expect(result.stats.discovered).toBe(1); // Only initial URL
      expect(result.stats.downloaded).toBe(1);
      expect(mockDownload).toHaveBeenCalledTimes(1);
    });

    it('should respect depth limits', async () => {
      const mockDownload = jest
        .spyOn(downloader, 'downloadResource')
        .mockResolvedValueOnce({
          success: true,
          content: Buffer.from('<html><a href="https://example.com/page1">Link</a></html>'),
          contentType: 'text/html',
          statusCode: 200,
        })
        .mockResolvedValueOnce({
          success: true,
          content: Buffer.from('<html><a href="https://example.com/page2">Link</a></html>'),
          contentType: 'text/html',
          statusCode: 200,
        });

      const mockWrite = jest.spyOn(writer, 'writeFile').mockResolvedValue({
        success: true,
        path: '/output/index.html',
      });

      const result = await scrape({
        targetUrl: 'https://example.com',
        outputDir: '/output',
        maxDepth: 1,
        includeSubdomains: false,
      });

      // Should download initial URL (depth 0) and page1 (depth 1)
      // But should not follow links from page1 (would be depth 2)
      expect(result.stats.discovered).toBe(2);
      expect(result.stats.downloaded).toBe(2);
    });

    it('should skip duplicate URLs', async () => {
      const mockDownload = jest
        .spyOn(downloader, 'downloadResource')
        .mockResolvedValueOnce({
          success: true,
          content: Buffer.from(
            '<html><a href="https://example.com/page1">Link</a><a href="https://example.com/page1">Duplicate</a></html>',
          ),
          contentType: 'text/html',
          statusCode: 200,
        })
        .mockResolvedValueOnce({
          success: true,
          content: Buffer.from('<html>Page 1</html>'),
          contentType: 'text/html',
          statusCode: 200,
        });

      const mockWrite = jest.spyOn(writer, 'writeFile').mockResolvedValue({
        success: true,
        path: '/output/index.html',
      });

      const result = await scrape({
        targetUrl: 'https://example.com',
        outputDir: '/output',
        maxDepth: null,
        includeSubdomains: false,
      });

      expect(result.stats.discovered).toBe(2); // Initial + page1 (not duplicate)
      expect(result.stats.downloaded).toBe(2);
      expect(mockDownload).toHaveBeenCalledTimes(2);
    });

    it('should parse CSS files for links', async () => {
      const mockDownload = jest
        .spyOn(downloader, 'downloadResource')
        .mockResolvedValueOnce({
          success: true,
          content: Buffer.from(
            '<html><link rel="stylesheet" href="https://example.com/style.css"></html>',
          ),
          contentType: 'text/html',
          statusCode: 200,
        })
        .mockResolvedValueOnce({
          success: true,
          content: Buffer.from('body { background: url(https://example.com/bg.png); }'),
          contentType: 'text/css',
          statusCode: 200,
        })
        .mockResolvedValueOnce({
          success: true,
          content: Buffer.from('PNG_DATA'),
          contentType: 'image/png',
          statusCode: 200,
        });

      const mockWrite = jest.spyOn(writer, 'writeFile').mockResolvedValue({
        success: true,
        path: '/output/file',
      });

      const result = await scrape({
        targetUrl: 'https://example.com',
        outputDir: '/output',
        maxDepth: null,
        includeSubdomains: false,
      });

      expect(result.stats.discovered).toBe(3);
      expect(result.stats.downloaded).toBe(3);
    });

    it('should track total bytes downloaded', async () => {
      const content1 = Buffer.from('<html></html>');
      const content2 = Buffer.from('<html>Page 1</html>');

      const mockDownload = jest
        .spyOn(downloader, 'downloadResource')
        .mockResolvedValueOnce({
          success: true,
          content: content1,
          contentType: 'text/html',
          statusCode: 200,
        })
        .mockResolvedValueOnce({
          success: true,
          content: content2,
          contentType: 'text/html',
          statusCode: 200,
        });

      const mockWrite = jest.spyOn(writer, 'writeFile').mockResolvedValue({
        success: true,
        path: '/output/index.html',
      });

      const result = await scrape({
        targetUrl: 'https://example.com',
        outputDir: '/output',
        maxDepth: 0,
        includeSubdomains: false,
      });

      expect(result.stats.totalBytes).toBe(content1.length);
    });
  });
});
