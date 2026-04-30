/**
 * Property-based tests for URL validator
 * Feature: website-scraper-downloader
 * Tests Requirements 1.1, 1.2, 9.1
 */

import * as fc from 'fast-check';
import { extractDomain, validateUrl } from './validator';

describe('URL Validator - Property-Based Tests', () => {
  /**
   * Property 1: Valid URL Acceptance
   * For any valid URL string, the scraper should accept it without returning an error.
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Valid URL Acceptance', () => {
    it('Feature: website-scraper-downloader, Property 1: Valid URL Acceptance', () => {
      fc.assert(
        fc.property(fc.webUrl({ validSchemes: ['http', 'https'] }), (url) => {
          const result = validateUrl(url);

          // Property: Valid URLs should be accepted
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
          expect(result.normalizedUrl).toBeDefined();
          expect(typeof result.normalizedUrl).toBe('string');
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 2: Invalid URL Rejection
   * For any invalid URL string, the scraper should reject it and return a descriptive error message.
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: Invalid URL Rejection', () => {
    it('Feature: website-scraper-downloader, Property 2: Invalid URL Rejection', () => {
      // Generator for invalid URLs
      const invalidUrlArbitrary = fc.oneof(
        // Empty strings
        fc.constant(''),
        fc.constant('   '),

        // Strings without protocol
        fc.domain(),

        // Invalid protocols
        fc
          .tuple(fc.constantFrom('ftp', 'file', 'mailto', 'data', 'javascript'), fc.domain())
          .map(([protocol, domain]) => `${protocol}://${domain}`),

        // Malformed URLs
        fc.string().filter((s) => {
          // Filter out strings that might accidentally be valid URLs
          try {
            const parsed = new URL(s);
            return parsed.protocol !== 'http:' && parsed.protocol !== 'https:';
          } catch {
            return true; // Keep strings that throw (they're invalid)
          }
        }),

        // URLs without hostname
        fc.constantFrom('http://', 'https://', 'http:///', 'https:///'),
      );

      fc.assert(
        fc.property(invalidUrlArbitrary, (url) => {
          const result = validateUrl(url);

          // Property: Invalid URLs should be rejected with an error message
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error?.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 14: Domain Extraction
   * For any valid URL, domain extraction should return a non-empty domain string.
   * **Validates: Requirements 9.1**
   */
  describe('Property 14: Domain Extraction', () => {
    it('Feature: website-scraper-downloader, Property 14: Domain Extraction', () => {
      fc.assert(
        fc.property(fc.webUrl({ validSchemes: ['http', 'https'] }), (url) => {
          const domain = extractDomain(url);

          // Property: Domain extraction should return a non-empty string
          expect(typeof domain).toBe('string');
          expect(domain.length).toBeGreaterThan(0);

          // Property: Domain should not contain protocol
          expect(domain).not.toContain('http://');
          expect(domain).not.toContain('https://');

          // Property: Domain should not contain path separators
          expect(domain).not.toContain('/');
        }),
        { numRuns: 100 },
      );
    });

    it('should throw error for invalid URLs', () => {
      const invalidUrlArbitrary = fc.oneof(
        fc.constant(''),
        fc.constant('not a url'),
        fc.string().filter((s) => {
          try {
            new URL(s);
            return false;
          } catch {
            return true;
          }
        }),
      );

      fc.assert(
        fc.property(invalidUrlArbitrary, (url) => {
          // Property: Invalid URLs should throw an error
          expect(() => extractDomain(url)).toThrow();
        }),
        { numRuns: 100 },
      );
    });
  });
});
