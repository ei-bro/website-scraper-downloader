/**
 * Unit tests for URL validator
 * Tests Requirements 1.1, 1.2, 1.3, 9.1
 */

import axios from 'axios';
import { extractDomain, isReachable, validateUrl } from './validator';

// Mock axios for isReachable tests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('URL Validator', () => {
  describe('validateUrl', () => {
    describe('valid URLs', () => {
      it('should accept valid HTTP URL', () => {
        const result = validateUrl('http://example.com');
        expect(result.valid).toBe(true);
        expect(result.normalizedUrl).toBe('http://example.com/');
        expect(result.error).toBeUndefined();
      });

      it('should accept valid HTTPS URL', () => {
        const result = validateUrl('https://example.com');
        expect(result.valid).toBe(true);
        expect(result.normalizedUrl).toBe('https://example.com/');
      });

      it('should accept URL with path', () => {
        const result = validateUrl('https://example.com/path/to/page');
        expect(result.valid).toBe(true);
        expect(result.normalizedUrl).toBe('https://example.com/path/to/page');
      });

      it('should accept URL with query parameters', () => {
        const result = validateUrl('https://example.com/page?param=value');
        expect(result.valid).toBe(true);
        expect(result.normalizedUrl).toBe('https://example.com/page?param=value');
      });

      it('should accept URL with port', () => {
        const result = validateUrl('https://example.com:8080/page');
        expect(result.valid).toBe(true);
        expect(result.normalizedUrl).toBe('https://example.com:8080/page');
      });

      it('should accept URL with subdomain', () => {
        const result = validateUrl('https://sub.example.com');
        expect(result.valid).toBe(true);
        expect(result.normalizedUrl).toBe('https://sub.example.com/');
      });

      it('should trim whitespace from URL', () => {
        const result = validateUrl('  https://example.com  ');
        expect(result.valid).toBe(true);
        expect(result.normalizedUrl).toBe('https://example.com/');
      });
    });

    describe('invalid URLs', () => {
      it('should reject empty string', () => {
        const result = validateUrl('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('URL cannot be empty');
      });

      it('should reject whitespace-only string', () => {
        const result = validateUrl('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('URL cannot be empty');
      });

      it('should reject malformed URL', () => {
        const result = validateUrl('not a url');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });

      it('should reject URL without protocol', () => {
        const result = validateUrl('example.com');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });

      it('should reject FTP protocol', () => {
        const result = validateUrl('ftp://example.com');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unsupported protocol');
        expect(result.error).toContain('ftp:');
      });

      it('should reject file protocol', () => {
        const result = validateUrl('file:///path/to/file');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unsupported protocol');
      });

      it('should reject URL without hostname', () => {
        const result = validateUrl('https://');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });
    });
  });

  describe('isReachable', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return true for successful response (200)', async () => {
      mockedAxios.head.mockResolvedValue({ status: 200 });

      const result = await isReachable('https://example.com');

      expect(result).toBe(true);
      expect(mockedAxios.head).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          timeout: 10000,
        }),
      );
    });

    it('should return true for redirect response (301)', async () => {
      mockedAxios.head.mockResolvedValue({ status: 301 });

      const result = await isReachable('https://example.com');

      expect(result).toBe(true);
    });

    it('should return true for client error (404)', async () => {
      mockedAxios.head.mockResolvedValue({ status: 404 });

      const result = await isReachable('https://example.com');

      expect(result).toBe(true);
    });

    it('should return false for server error (500)', async () => {
      mockedAxios.head.mockResolvedValue({ status: 500 });

      const result = await isReachable('https://example.com');

      expect(result).toBe(false);
    });

    it('should return false for network error', async () => {
      mockedAxios.head.mockRejectedValue(new Error('Network error'));

      const result = await isReachable('https://unreachable.example.com');

      expect(result).toBe(false);
    });

    it('should return false for timeout', async () => {
      mockedAxios.head.mockRejectedValue(new Error('Timeout'));

      const result = await isReachable('https://slow.example.com');

      expect(result).toBe(false);
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from simple URL', () => {
      const domain = extractDomain('https://example.com');
      expect(domain).toBe('example.com');
    });

    it('should extract domain from URL with path', () => {
      const domain = extractDomain('https://example.com/path/to/page');
      expect(domain).toBe('example.com');
    });

    it('should extract domain from URL with subdomain', () => {
      const domain = extractDomain('https://sub.example.com');
      expect(domain).toBe('sub.example.com');
    });

    it('should extract domain from URL with port', () => {
      const domain = extractDomain('https://example.com:8080');
      expect(domain).toBe('example.com');
    });

    it('should extract domain from URL with query parameters', () => {
      const domain = extractDomain('https://example.com/page?param=value');
      expect(domain).toBe('example.com');
    });

    it('should extract domain from HTTP URL', () => {
      const domain = extractDomain('http://example.com');
      expect(domain).toBe('example.com');
    });

    it('should throw error for invalid URL', () => {
      expect(() => extractDomain('not a url')).toThrow('Cannot extract domain from invalid URL');
    });

    it('should throw error for empty string', () => {
      expect(() => extractDomain('')).toThrow('Cannot extract domain from invalid URL');
    });
  });
});
