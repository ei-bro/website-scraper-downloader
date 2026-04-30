/**
 * Unit tests for HTTP downloader module
 */

import axios from 'axios';
import { downloadResource } from './downloader';
import { DownloadResult } from '../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('downloadResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('successful downloads', () => {
    it('should download HTML content successfully', async () => {
      const mockContent = '<html><body>Test</body></html>';
      mockedAxios.get.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: Buffer.from(mockContent),
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });

      const result = await downloadResource('https://example.com/page.html');

      expect(result.success).toBe(true);
      expect(result.content?.toString()).toBe(mockContent);
      expect(result.contentType).toBe('text/html; charset=utf-8');
      expect(result.statusCode).toBe(200);
      expect(result.error).toBeUndefined();
    });

    it('should download CSS content successfully', async () => {
      const mockContent = 'body { color: red; }';
      mockedAxios.get.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: Buffer.from(mockContent),
        headers: { 'content-type': 'text/css' },
      });

      const result = await downloadResource('https://example.com/style.css');

      expect(result.success).toBe(true);
      expect(result.content?.toString()).toBe(mockContent);
      expect(result.contentType).toBe('text/css');
    });

    it('should download JavaScript content successfully', async () => {
      const mockContent = 'console.log("test");';
      mockedAxios.get.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: Buffer.from(mockContent),
        headers: { 'content-type': 'application/javascript' },
      });

      const result = await downloadResource('https://example.com/script.js');

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('application/javascript');
    });

    it('should download image content successfully', async () => {
      const mockContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
      mockedAxios.get.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: mockContent,
        headers: { 'content-type': 'image/png' },
      });

      const result = await downloadResource('https://example.com/image.png');

      expect(result.success).toBe(true);
      expect(result.content).toEqual(mockContent);
      expect(result.contentType).toBe('image/png');
    });

    it('should use default content-type when not provided', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: Buffer.from('content'),
        headers: {},
      });

      const result = await downloadResource('https://example.com/file');

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('application/octet-stream');
    });
  });

  describe('HTTP error handling', () => {
    it('should handle 404 Not Found error', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
        data: Buffer.from(''),
        headers: {},
      });

      const result = await downloadResource('https://example.com/missing.html');

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.error).toContain('404');
      expect(result.content).toBeUndefined();
    });

    it('should handle 403 Forbidden error', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 403,
        statusText: 'Forbidden',
        data: Buffer.from(''),
        headers: {},
      });

      const result = await downloadResource(
        'https://example.com/forbidden.html',
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain('403');
    });

    it('should handle 500 Internal Server Error', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        data: Buffer.from(''),
        headers: {},
      });

      const result = await downloadResource('https://example.com/error.html');

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain('500');
    });
  });

  describe('network error handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(timeoutError);

      const downloadPromise = downloadResource(
        'https://example.com/slow.html',
        5000,
      );

      await jest.runAllTimersAsync();

      const result = await downloadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.error).toContain('5000ms');
    });

    it('should handle connection refused errors', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:80',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(connectionError);

      const downloadPromise = downloadResource('https://example.com/page.html');

      await jest.runAllTimersAsync();

      const result = await downloadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle DNS resolution failures', async () => {
      const dnsError = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND invalid.example.com',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(dnsError);

      const downloadPromise = downloadResource(
        'https://invalid.example.com/page.html',
      );

      await jest.runAllTimersAsync();

      const result = await downloadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle DNS EAI_AGAIN errors', async () => {
      const dnsError = {
        code: 'EAI_AGAIN',
        message: 'getaddrinfo EAI_AGAIN',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(dnsError);

      const downloadPromise = downloadResource('https://example.com/page.html');

      await jest.runAllTimersAsync();

      const result = await downloadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle generic axios errors', async () => {
      const genericError = {
        message: 'Request failed',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(genericError);

      const result = await downloadResource('https://example.com/page.html');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request failed');
    });

    it('should handle non-axios errors', async () => {
      const genericError = new Error('Unexpected error');
      mockedAxios.isAxiosError.mockReturnValue(false);
      mockedAxios.get.mockRejectedValue(genericError);

      const result = await downloadResource('https://example.com/page.html');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should handle unknown errors', async () => {
      mockedAxios.isAxiosError.mockReturnValue(false);
      mockedAxios.get.mockRejectedValue('string error');

      const result = await downloadResource('https://example.com/page.html');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });
  });

  describe('timeout configuration', () => {
    it('should use default timeout when not specified', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('content'),
        headers: {},
      });

      await downloadResource('https://example.com/page.html');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com/page.html',
        expect.objectContaining({
          timeout: 30000,
        }),
      );
    });

    it('should use custom timeout when specified', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('content'),
        headers: {},
      });

      await downloadResource('https://example.com/page.html', 10000);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com/page.html',
        expect.objectContaining({
          timeout: 10000,
        }),
      );
    });
  });

  describe('request configuration', () => {
    it('should set User-Agent header', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('content'),
        headers: {},
      });

      await downloadResource('https://example.com/page.html');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com/page.html',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('WebScraperDownloader'),
          }),
        }),
      );
    });

    it('should request arraybuffer response type', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('content'),
        headers: {},
      });

      await downloadResource('https://example.com/page.html');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com/page.html',
        expect.objectContaining({
          responseType: 'arraybuffer',
        }),
      );
    });
  });

  describe('retry logic with exponential backoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry up to 3 times on timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(timeoutError);

      const downloadPromise = downloadResource(
        'https://example.com/slow.html',
        5000,
      );

      // Fast-forward through all retries
      await jest.runAllTimersAsync();

      const result = await downloadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(mockedAxios.get).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should use exponential backoff between retries', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout exceeded',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(timeoutError);

      const downloadPromise = downloadResource('https://example.com/slow.html');

      // First attempt
      await Promise.resolve();
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Wait 1 second (2^0 * 1000ms)
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      // Wait 2 seconds (2^1 * 1000ms)
      await jest.advanceTimersByTimeAsync(2000);
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);

      // Wait 4 seconds (2^2 * 1000ms)
      await jest.advanceTimersByTimeAsync(4000);
      expect(mockedAxios.get).toHaveBeenCalledTimes(4);

      await downloadPromise;
    });

    it('should succeed on retry if request succeeds', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout exceeded',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);

      // Fail first two attempts, succeed on third
      mockedAxios.get
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          data: Buffer.from('success'),
          headers: { 'content-type': 'text/html' },
        });

      const downloadPromise = downloadResource('https://example.com/page.html');

      // Fast-forward through retries
      await jest.runAllTimersAsync();

      const result = await downloadPromise;

      expect(result.success).toBe(true);
      expect(result.content?.toString()).toBe('success');
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });

    it('should retry on network connection errors', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(connectionError);

      const downloadPromise = downloadResource('https://example.com/page.html');

      await jest.runAllTimersAsync();

      const result = await downloadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(mockedAxios.get).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should retry on DNS resolution failures', async () => {
      const dnsError = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(dnsError);

      const downloadPromise = downloadResource('https://example.com/page.html');

      await jest.runAllTimersAsync();

      const result = await downloadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(mockedAxios.get).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should not retry on HTTP 404 errors', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
        data: Buffer.from(''),
        headers: {},
      });

      const result = await downloadResource('https://example.com/missing.html');

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // No retries
    });

    it('should not retry on HTTP 500 errors', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        data: Buffer.from(''),
        headers: {},
      });

      const result = await downloadResource('https://example.com/error.html');

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // No retries
    });

    it('should respect custom maxRetries parameter', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout exceeded',
        isAxiosError: true,
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(timeoutError);

      const downloadPromise = downloadResource(
        'https://example.com/slow.html',
        5000,
        1, // Only 1 retry
      );

      await jest.runAllTimersAsync();

      const result = await downloadPromise;

      expect(result.success).toBe(false);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });
});
