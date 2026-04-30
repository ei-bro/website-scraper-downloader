/**
 * Property-based tests for URL normalization
 * Feature: website-scraper-downloader
 * Tests Requirements 8.1, 8.2, 8.3, 7.4
 */

import * as fc from 'fast-check';
import { normalizeUrl, resolveRelativeUrl } from './validator';

describe('URL Normalizer - Property-Based Tests', () => {
  /**
   * Property 10: URL Resolution
   * For any relative URL and base URL context, the scraper should resolve
   * the relative URL to a valid absolute URL.
   * **Validates: Requirements 7.4, 8.3**
   */
  describe('Property 10: URL Resolution', () => {
    it('Feature: website-scraper-downloader, Property 10: URL Resolution', () => {
      // Generator for base URLs
      const baseUrlArbitrary = fc.webUrl({ validSchemes: ['http', 'https'] });

      // Generator for relative URLs
      const relativeUrlArbitrary = fc.oneof(
        // Simple relative paths
        fc
          .array(fc.stringMatching(/^[a-z0-9-]+$/), {
            minLength: 1,
            maxLength: 3,
          })
          .map(parts => parts.join('/')),

        // Paths with file extensions
        fc
          .tuple(
            fc.stringMatching(/^[a-z0-9-]+$/),
            fc.constantFrom('html', 'css', 'js', 'png', 'jpg'),
          )
          .map(([name, ext]) => `${name}.${ext}`),

        // Parent directory references
        fc
          .tuple(
            fc.constantFrom('..', '../..'),
            fc.stringMatching(/^[a-z0-9-]+$/),
          )
          .map(([parent, file]) => `${parent}/${file}`),

        // Root-relative paths
        fc
          .array(fc.stringMatching(/^[a-z0-9-]+$/), {
            minLength: 1,
            maxLength: 3,
          })
          .map(parts => `/${parts.join('/')}`),

        // Current directory references
        fc.stringMatching(/^[a-z0-9-]+$/).map(file => `./${file}`),

        // Empty relative URL (should resolve to base)
        fc.constant(''),
      );

      fc.assert(
        fc.property(
          baseUrlArbitrary,
          relativeUrlArbitrary,
          (baseUrl, relativeUrl) => {
            const resolved = resolveRelativeUrl(baseUrl, relativeUrl);

            // Property: Result should be a valid absolute URL
            expect(typeof resolved).toBe('string');
            expect(resolved.length).toBeGreaterThan(0);

            // Property: Result should be parseable as a URL
            expect(() => new URL(resolved)).not.toThrow();

            // Property: Result should have http or https protocol
            const parsedResolved = new URL(resolved);
            expect(['http:', 'https:']).toContain(parsedResolved.protocol);

            // Property: Result should have a hostname
            expect(parsedResolved.hostname.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle absolute URLs in relative position', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (baseUrl, absoluteUrl) => {
            const resolved = resolveRelativeUrl(baseUrl, absoluteUrl);

            // Property: Absolute URLs should resolve to themselves (semantically)
            // Note: URL constructor may normalize (e.g., add trailing slash to root)
            const parsedAbsolute = new URL(absoluteUrl);
            const parsedResolved = new URL(resolved);

            expect(parsedResolved.protocol).toBe(parsedAbsolute.protocol);
            expect(parsedResolved.hostname).toBe(parsedAbsolute.hostname);
            expect(parsedResolved.port).toBe(parsedAbsolute.port);
            expect(parsedResolved.pathname).toBe(parsedAbsolute.pathname);
            expect(parsedResolved.search).toBe(parsedAbsolute.search);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 11: URL Normalization Idempotence
   * For any URL, normalizing it multiple times should produce the same result
   * as normalizing it once.
   * **Validates: Requirements 8.1**
   */
  describe('Property 11: URL Normalization Idempotence', () => {
    it('Feature: website-scraper-downloader, Property 11: URL Normalization Idempotence', () => {
      // Generator for URLs with various normalization opportunities
      const unnormalizedUrlArbitrary = fc
        .tuple(
          fc.constantFrom('http', 'https'),
          fc.domain(),
          fc.option(fc.constantFrom('80', '443', '8080', '3000'), {
            nil: null,
          }),
          fc.array(fc.stringMatching(/^[a-z0-9-]+$/), {
            minLength: 0,
            maxLength: 3,
          }),
          fc.option(fc.boolean(), { nil: null }), // trailing slash
          fc.option(
            fc.dictionary(
              fc.stringMatching(/^[a-z]+$/),
              fc.stringMatching(/^[a-z0-9]+$/),
            ),
            { nil: null },
          ), // query params
          fc.option(fc.stringMatching(/^[a-z0-9-]+$/), { nil: null }), // fragment
        )
        .map(
          ([
            protocol,
            domain,
            port,
            pathParts,
            trailingSlash,
            queryParams,
            fragment,
          ]) => {
            // Randomly uppercase domain
            const domainCase =
              Math.random() > 0.5 ? domain.toUpperCase() : domain;

            let url = `${protocol}://${domainCase}`;

            // Add port if present
            if (port !== null) {
              url += `:${port}`;
            }

            // Add path
            const path = pathParts.length > 0 ? `/${pathParts.join('/')}` : '';
            url += path;

            // Add trailing slash if specified and path is not empty
            if (trailingSlash && path.length > 0) {
              url += '/';
            }

            // Add query parameters
            if (queryParams !== null && Object.keys(queryParams).length > 0) {
              const params = new URLSearchParams(queryParams);
              url += `?${params.toString()}`;
            }

            // Add fragment
            if (fragment !== null) {
              url += `#${fragment}`;
            }

            return url;
          },
        );

      fc.assert(
        fc.property(unnormalizedUrlArbitrary, url => {
          const normalized1 = normalizeUrl(url);
          const normalized2 = normalizeUrl(normalized1);
          const normalized3 = normalizeUrl(normalized2);

          // Property: Normalizing multiple times produces the same result
          expect(normalized1).toBe(normalized2);
          expect(normalized2).toBe(normalized3);

          // Property: Normalized URL should be valid
          expect(() => new URL(normalized1)).not.toThrow();
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 12: Trailing Slash Equivalence
   * For any URL, the normalized form with a trailing slash should be equivalent
   * to the normalized form without a trailing slash.
   * **Validates: Requirements 8.2**
   */
  describe('Property 12: Trailing Slash Equivalence', () => {
    it('Feature: website-scraper-downloader, Property 12: Trailing Slash Equivalence', () => {
      // Generator for URLs with non-root paths
      const urlWithPathArbitrary = fc
        .tuple(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.array(fc.stringMatching(/^[a-z0-9-]+$/), {
            minLength: 1,
            maxLength: 3,
          }),
        )
        .map(([baseUrl, pathParts]) => {
          const parsed = new URL(baseUrl);
          parsed.pathname = `/${pathParts.join('/')}`;
          return parsed.href;
        });

      fc.assert(
        fc.property(urlWithPathArbitrary, url => {
          // Ensure URL has a non-root path
          const parsed = new URL(url);
          if (parsed.pathname === '/' || parsed.pathname === '') {
            return; // Skip root paths
          }

          // Create versions with and without trailing slash
          const withoutSlash = url.endsWith('/') ? url.slice(0, -1) : url;
          const withSlash = url.endsWith('/') ? url : url + '/';

          const normalizedWithout = normalizeUrl(withoutSlash);
          const normalizedWith = normalizeUrl(withSlash);

          // Property: Both should normalize to the same URL (without trailing slash)
          expect(normalizedWithout).toBe(normalizedWith);

          // Property: Normalized URL should not have trailing slash (except root)
          const normalizedParsed = new URL(normalizedWithout);
          if (normalizedParsed.pathname !== '/') {
            expect(normalizedParsed.pathname.endsWith('/')).toBe(false);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve trailing slash for root paths', () => {
      fc.assert(
        fc.property(fc.webUrl({ validSchemes: ['http', 'https'] }), baseUrl => {
          const parsed = new URL(baseUrl);
          parsed.pathname = '/';
          const rootUrl = parsed.href;

          const normalized = normalizeUrl(rootUrl);
          const normalizedParsed = new URL(normalized);

          // Property: Root path should keep trailing slash
          expect(normalizedParsed.pathname).toBe('/');
        }),
        { numRuns: 100 },
      );
    });
  });
});
