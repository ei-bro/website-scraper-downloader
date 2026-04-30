/**
 * Property-based tests for domain filtering and depth tracking
 * Feature: website-scraper-downloader
 * Tests Requirements 9.2, 9.3, 9.4, 14.2, 14.3
 */

import * as fc from 'fast-check';
import { shouldDownloadUrl, shouldFollowLinks, shouldProcessDepth } from './filter';

describe('Domain Filtering - Property-Based Tests', () => {
  /**
   * Property 15: Cross-Domain Filtering
   * For any discovered URL with a domain different from the target domain
   * (excluding subdomains when configured), the URL should not be added to the download queue.
   * **Validates: Requirements 9.2, 9.3, 9.4**
   */
  describe('Property 15: Cross-Domain Filtering', () => {
    it('Feature: website-scraper-downloader, Property 15: Cross-Domain Filtering', () => {
      // Generator for target domain
      const targetDomainArbitrary = fc.domain();

      // Generator for subdomain inclusion flag
      const includeSubdomainsArbitrary = fc.boolean();

      fc.assert(
        fc.property(
          targetDomainArbitrary,
          includeSubdomainsArbitrary,
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (targetDomain, includeSubdomains, url) => {
            const result = shouldDownloadUrl(url, targetDomain, includeSubdomains);

            // Extract the URL's domain
            let urlDomain: string;
            try {
              const parsed = new URL(url);
              urlDomain = parsed.hostname;
            } catch {
              // Invalid URL should be rejected
              expect(result).toBe(false);
              return;
            }

            // Property 1: Exact domain match should always be allowed
            if (urlDomain === targetDomain) {
              expect(result).toBe(true);
              return;
            }

            // Property 2: Different domain (not a subdomain) should be rejected
            if (!urlDomain.endsWith(`.${targetDomain}`)) {
              expect(result).toBe(false);
              return;
            }

            // Property 3: Subdomain handling depends on includeSubdomains flag
            if (urlDomain.endsWith(`.${targetDomain}`)) {
              if (includeSubdomains) {
                expect(result).toBe(true);
              } else {
                expect(result).toBe(false);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle same domain with different paths', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          fc.webPath(),
          fc.webPath(),
          fc.boolean(),
          (domain, path1, path2, includeSubdomains) => {
            const url1 = `https://${domain}${path1}`;
            const url2 = `https://${domain}${path2}`;

            // Property: URLs from the same domain should both be allowed
            expect(shouldDownloadUrl(url1, domain, includeSubdomains)).toBe(true);
            expect(shouldDownloadUrl(url2, domain, includeSubdomains)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should consistently handle subdomain inclusion', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => {
            // Filter out strings with dots, whitespace, or invalid hostname characters
            return !s.includes('.') && /^[a-z0-9-]+$/i.test(s);
          }),
          (baseDomain, subPrefix) => {
            const subdomainUrl = `https://${subPrefix}.${baseDomain}/page`;

            // Property: With includeSubdomains=false, subdomain should be rejected
            expect(shouldDownloadUrl(subdomainUrl, baseDomain, false)).toBe(false);

            // Property: With includeSubdomains=true, subdomain should be allowed
            expect(shouldDownloadUrl(subdomainUrl, baseDomain, true)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

describe('Depth Tracking - Property-Based Tests', () => {
  /**
   * Property 23: Depth Tracking
   * For any resource in the download queue, its depth value should equal
   * the minimum number of link hops from the target URL.
   * **Validates: Requirements 14.2**
   */
  describe('Property 23: Depth Tracking', () => {
    it('Feature: website-scraper-downloader, Property 23: Depth Tracking', () => {
      // Generator for depth values (0 to 100)
      const depthArbitrary = fc.nat({ max: 100 });

      // Generator for maxDepth (null or a positive number)
      const maxDepthArbitrary = fc.oneof(fc.constant(null), fc.nat({ max: 50 }));

      fc.assert(
        fc.property(depthArbitrary, maxDepthArbitrary, (currentDepth, maxDepth) => {
          const shouldProcess = shouldProcessDepth(currentDepth, maxDepth);

          // Property 1: With no depth limit (null), all depths should be processed
          if (maxDepth === null) {
            expect(shouldProcess).toBe(true);
            return;
          }

          // Property 2: Depths within limit should be processed
          if (currentDepth <= maxDepth) {
            expect(shouldProcess).toBe(true);
          } else {
            // Property 3: Depths exceeding limit should not be processed
            expect(shouldProcess).toBe(false);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should handle depth 0 correctly', () => {
      fc.assert(
        fc.property(fc.oneof(fc.constant(null), fc.nat({ max: 50 })), (maxDepth) => {
          // Property: Depth 0 (starting URL) should always be processed
          expect(shouldProcessDepth(0, maxDepth)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 24: Depth Limit Enforcement
   * For any resource at maximum depth (when depth limiting is enabled),
   * links discovered in that resource should not be added to the download queue.
   * **Validates: Requirements 14.3**
   */
  describe('Property 24: Depth Limit Enforcement', () => {
    it('Feature: website-scraper-downloader, Property 24: Depth Limit Enforcement', () => {
      // Generator for depth values (0 to 100)
      const depthArbitrary = fc.nat({ max: 100 });

      // Generator for maxDepth (null or a positive number)
      const maxDepthArbitrary = fc.oneof(fc.constant(null), fc.nat({ max: 50 }));

      fc.assert(
        fc.property(depthArbitrary, maxDepthArbitrary, (currentDepth, maxDepth) => {
          const shouldFollow = shouldFollowLinks(currentDepth, maxDepth);

          // Property 1: With no depth limit (null), all links should be followed
          if (maxDepth === null) {
            expect(shouldFollow).toBe(true);
            return;
          }

          // Property 2: Links should be followed only if current depth < maxDepth
          if (currentDepth < maxDepth) {
            expect(shouldFollow).toBe(true);
          } else {
            // Property 3: At or beyond maxDepth, links should not be followed
            expect(shouldFollow).toBe(false);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should enforce that resources at maxDepth do not follow links', () => {
      fc.assert(
        fc.property(fc.nat({ max: 50 }), (maxDepth) => {
          // Property: Resource at exactly maxDepth should not follow links
          expect(shouldFollowLinks(maxDepth, maxDepth)).toBe(false);

          // Property: Resource one level before maxDepth should follow links
          if (maxDepth > 0) {
            expect(shouldFollowLinks(maxDepth - 1, maxDepth)).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should handle unlimited depth correctly', () => {
      fc.assert(
        fc.property(fc.nat({ max: 1000 }), (depth) => {
          // Property: With unlimited depth (null), all depths should follow links
          expect(shouldFollowLinks(depth, null)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });
});
