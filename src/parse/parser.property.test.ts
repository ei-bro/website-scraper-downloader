/**
 * Property-based tests for HTML parser
 * Feature: website-scraper-downloader
 * Tests Requirements 3.1, 3.2, 3.3, 3.4
 */

import * as fc from 'fast-check';
import { parseHtml, parseCss } from './parser';
import { resolveRelativeUrl } from '../url/validator';

describe('HTML Parser - Property-Based Tests', () => {
  /**
   * Property 5: Comprehensive Resource Discovery
   * For any HTML file, parsing should extract all URLs from href attributes
   * (link, anchor tags), src attributes (script, img, iframe, source tags),
   * and CSS url() references (style tags and attributes).
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  describe('Property 5: Comprehensive Resource Discovery', () => {
    it('Feature: website-scraper-downloader, Property 5: Comprehensive Resource Discovery', () => {
      // Generator for valid URLs
      const urlArbitrary = fc.oneof(
        // Absolute URLs
        fc.webUrl({ validSchemes: ['http', 'https'] }),
        // Relative paths
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
            fc.constantFrom('html', 'css', 'js', 'png', 'jpg', 'svg', 'woff'),
          )
          .map(([name, ext]) => `${name}.${ext}`),
        // Root-relative paths
        fc
          .array(fc.stringMatching(/^[a-z0-9-]+$/), {
            minLength: 1,
            maxLength: 3,
          })
          .map(parts => `/${parts.join('/')}`),
      );

      // Generator for href-based tags (link, anchor)
      const hrefTagArbitrary = fc
        .tuple(fc.constantFrom('a', 'link'), urlArbitrary)
        .map(([tag, url]) => {
          if (tag === 'a') {
            return `<a href="${url}">Link</a>`;
          } else {
            return `<link rel="stylesheet" href="${url}">`;
          }
        });

      // Generator for src-based tags (script, img, iframe, source)
      const srcTagArbitrary = fc
        .tuple(
          fc.constantFrom('script', 'img', 'iframe', 'source'),
          urlArbitrary,
        )
        .map(([tag, url]) => {
          if (tag === 'script') {
            return `<script src="${url}"></script>`;
          } else if (tag === 'img') {
            return `<img src="${url}" alt="image">`;
          } else if (tag === 'iframe') {
            return `<iframe src="${url}"></iframe>`;
          } else {
            return `<source src="${url}" type="video/mp4">`;
          }
        });

      // Generator for CSS url() in style attributes
      const styleAttrArbitrary = fc
        .tuple(urlArbitrary, fc.constantFrom('url', 'url-quotes'))
        .map(([url, format]) => {
          const cssUrl = format === 'url' ? `url(${url})` : `url("${url}")`;
          return `<div style="background-image: ${cssUrl}">Content</div>`;
        });

      // Generator for CSS url() in style tags
      const styleTagArbitrary = fc
        .tuple(urlArbitrary, fc.constantFrom('url', 'url-quotes'))
        .map(([url, format]) => {
          const cssUrl = format === 'url' ? `url(${url})` : `url("${url}")`;
          return `<style>.class { background: ${cssUrl}; }</style>`;
        });

      // Generator for HTML documents with various resource types
      const htmlDocumentArbitrary = fc
        .tuple(
          fc.array(hrefTagArbitrary, { minLength: 0, maxLength: 3 }),
          fc.array(srcTagArbitrary, { minLength: 0, maxLength: 3 }),
          fc.array(styleAttrArbitrary, { minLength: 0, maxLength: 2 }),
          fc.array(styleTagArbitrary, { minLength: 0, maxLength: 2 }),
        )
        .map(([hrefTags, srcTags, styleAttrs, styleTags]) => {
          const allTags = [
            ...hrefTags,
            ...srcTags,
            ...styleAttrs,
            ...styleTags,
          ];
          return allTags.join('\n');
        });

      const baseUrlArbitrary = fc.webUrl({ validSchemes: ['http', 'https'] });

      fc.assert(
        fc.property(
          htmlDocumentArbitrary,
          baseUrlArbitrary,
          (html, baseUrl) => {
            const result = parseHtml(html, baseUrl);

            // Property: Result should have links array
            expect(Array.isArray(result.links)).toBe(true);

            // Property: Result should have baseUrl
            expect(result.baseUrl).toBe(baseUrl);

            // Property: All links should be strings
            result.links.forEach(link => {
              expect(typeof link).toBe('string');
            });

            // Property: All links should be non-empty
            result.links.forEach(link => {
              expect(link.length).toBeGreaterThan(0);
            });

            // Property: Links should be unique (no duplicates)
            const uniqueLinks = new Set(result.links);
            expect(uniqueLinks.size).toBe(result.links.length);

            // Property: All links should be valid URLs (absolute)
            result.links.forEach(link => {
              expect(() => new URL(link)).not.toThrow();
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract all href URLs from anchor and link tags', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.constantFrom('a', 'link'),
              fc
                .tuple(
                  fc.domain(),
                  fc.array(fc.stringMatching(/^[a-z0-9-]+$/), {
                    minLength: 0,
                    maxLength: 2,
                  }),
                  fc.option(fc.stringMatching(/^[a-z0-9-]+$/), { nil: null }),
                  fc.constantFrom('html', 'css', 'js', 'png', ''),
                )
                .map(([domain, pathParts, file, ext]) => {
                  const path =
                    pathParts.length > 0 ? `/${pathParts.join('/')}` : '';
                  const filename = file
                    ? `/${file}${ext ? '.' + ext : ''}`
                    : '';
                  return `https://${domain}${path}${filename}`;
                }),
            ),
            { minLength: 1, maxLength: 5 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (tagUrlPairs, baseUrl) => {
            // Build HTML with known URLs
            const html = tagUrlPairs
              .map(([tag, url]) => {
                if (tag === 'a') {
                  return `<a href="${url}">Link</a>`;
                } else {
                  return `<link rel="stylesheet" href="${url}">`;
                }
              })
              .join('\n');

            const result = parseHtml(html, baseUrl);

            // Property: All href URLs should be extracted (resolved through same function)
            tagUrlPairs.forEach(([, url]) => {
              const expectedUrl = resolveRelativeUrl(baseUrl, url);
              expect(result.links).toContain(expectedUrl);
            });

            // Property: Number of unique URLs should match
            const uniqueUrls = new Set(
              tagUrlPairs.map(([, url]) => resolveRelativeUrl(baseUrl, url)),
            );
            expect(result.links.length).toBe(uniqueUrls.size);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract all src URLs from script, img, iframe, and source tags', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.constantFrom('script', 'img', 'iframe', 'source'),
              fc
                .tuple(
                  fc.domain(),
                  fc.array(fc.stringMatching(/^[a-z0-9-]+$/), {
                    minLength: 0,
                    maxLength: 2,
                  }),
                  fc.option(fc.stringMatching(/^[a-z0-9-]+$/), { nil: null }),
                  fc.constantFrom('js', 'png', 'jpg', 'mp4', ''),
                )
                .map(([domain, pathParts, file, ext]) => {
                  const path =
                    pathParts.length > 0 ? `/${pathParts.join('/')}` : '';
                  const filename = file
                    ? `/${file}${ext ? '.' + ext : ''}`
                    : '';
                  return `https://${domain}${path}${filename}`;
                }),
            ),
            { minLength: 1, maxLength: 5 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (tagUrlPairs, baseUrl) => {
            // Build HTML with known URLs
            const html = tagUrlPairs
              .map(([tag, url]) => {
                if (tag === 'script') {
                  return `<script src="${url}"></script>`;
                } else if (tag === 'img') {
                  return `<img src="${url}">`;
                } else if (tag === 'iframe') {
                  return `<iframe src="${url}"></iframe>`;
                } else {
                  return `<source src="${url}">`;
                }
              })
              .join('\n');

            const result = parseHtml(html, baseUrl);

            // Property: All src URLs should be extracted (resolved through same function)
            tagUrlPairs.forEach(([, url]) => {
              const expectedUrl = resolveRelativeUrl(baseUrl, url);
              expect(result.links).toContain(expectedUrl);
            });

            // Property: Number of unique URLs should match
            const uniqueUrls = new Set(
              tagUrlPairs.map(([, url]) => resolveRelativeUrl(baseUrl, url)),
            );
            expect(result.links.length).toBe(uniqueUrls.size);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract CSS url() references from style tags', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.stringMatching(/^[a-z0-9-]+$/),
              fc.constantFrom('png', 'jpg', 'svg', 'woff'),
            ),
            { minLength: 1, maxLength: 5 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (fileSpecs, baseUrl) => {
            // Build style tag with known URLs
            const cssRules = fileSpecs
              .map(
                ([name, ext], idx) =>
                  `.class${idx} { background: url("${name}.${ext}"); }`,
              )
              .join('\n');
            const html = `<style>${cssRules}</style>`;

            const result = parseHtml(html, baseUrl);

            // Property: All CSS URLs should be extracted and resolved
            fileSpecs.forEach(([name, ext]) => {
              const expectedUrl = `${baseUrl}/${name}.${ext}`;
              const found = result.links.some(link =>
                link.includes(`${name}.${ext}`),
              );
              expect(found).toBe(true);
            });

            // Property: Number of links should match number of unique files
            const uniqueFiles = new Set(
              fileSpecs.map(([name, ext]) => `${name}.${ext}`),
            );
            expect(result.links.length).toBe(uniqueFiles.size);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract CSS url() references from style attributes', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.stringMatching(/^[a-z0-9-]+$/),
              fc.constantFrom('png', 'jpg', 'svg'),
            ),
            { minLength: 1, maxLength: 5 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (fileSpecs, baseUrl) => {
            // Build HTML with style attributes containing known URLs
            const html = fileSpecs
              .map(
                ([name, ext]) =>
                  `<div style="background-image: url('${name}.${ext}')">Content</div>`,
              )
              .join('\n');

            const result = parseHtml(html, baseUrl);

            // Property: All CSS URLs from style attributes should be extracted
            fileSpecs.forEach(([name, ext]) => {
              const found = result.links.some(link =>
                link.includes(`${name}.${ext}`),
              );
              expect(found).toBe(true);
            });

            // Property: Number of links should match number of unique files
            const uniqueFiles = new Set(
              fileSpecs.map(([name, ext]) => `${name}.${ext}`),
            );
            expect(result.links.length).toBe(uniqueFiles.size);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should skip invalid URL types (fragments, javascript, mailto, data)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom(
              '#section',
              'javascript:void(0)',
              'mailto:test@example.com',
              'data:image/png;base64,abc',
            ),
            { minLength: 1, maxLength: 4 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (invalidUrls, baseUrl) => {
            // Build HTML with invalid URLs
            const html = invalidUrls
              .map(url => {
                if (url.startsWith('data:')) {
                  return `<style>.class { background: url("${url}"); }</style>`;
                } else {
                  return `<a href="${url}">Link</a>`;
                }
              })
              .join('\n');

            const result = parseHtml(html, baseUrl);

            // Property: Invalid URLs should not be extracted
            expect(result.links.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle mixed valid and invalid URLs', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(
            fc
              .tuple(
                fc.domain(),
                fc.array(fc.stringMatching(/^[a-z0-9-]+$/), {
                  minLength: 0,
                  maxLength: 2,
                }),
                fc.stringMatching(/^[a-z0-9-]+$/),
                fc.constantFrom('html', 'css', 'js', ''),
              )
              .map(([domain, pathParts, file, ext]) => {
                const path =
                  pathParts.length > 0 ? `/${pathParts.join('/')}` : '';
                const filename = `/${file}${ext ? '.' + ext : ''}`;
                return `https://${domain}${path}${filename}`;
              }),
            {
              minLength: 1,
              maxLength: 3,
            },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (validUrls, baseUrl) => {
            // Build HTML with mix of valid and invalid URLs
            const validHtml = validUrls
              .map(url => `<a href="${url}">Link</a>`)
              .join('\n');
            const invalidHtml = `
              <a href="#fragment">Fragment</a>
              <a href="javascript:void(0)">JS</a>
              <a href="mailto:test@example.com">Email</a>
            `;
            const html = validHtml + '\n' + invalidHtml;

            const result = parseHtml(html, baseUrl);

            // Property: Only valid URLs should be extracted (accounting for deduplication)
            const uniqueExpectedUrls = new Set(
              validUrls.map(url => resolveRelativeUrl(baseUrl, url)),
            );
            expect(result.links.length).toBe(uniqueExpectedUrls.size);

            uniqueExpectedUrls.forEach(expectedUrl => {
              expect(result.links).toContain(expectedUrl);
            });

            // Property: Invalid URLs should not be present
            expect(result.links.every(link => !link.startsWith('#'))).toBe(
              true,
            );
            expect(
              result.links.every(link => !link.startsWith('javascript:')),
            ).toBe(true);
            expect(
              result.links.every(link => !link.startsWith('mailto:')),
            ).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 7: CSS Resource Extraction
   * For any CSS file content, parsing should extract all URLs from @import
   * statements and url() functions.
   * **Validates: Requirements 4.3, 4.4**
   */
  describe('Property 7: CSS Resource Extraction', () => {
    it('Feature: website-scraper-downloader, Property 7: CSS Resource Extraction', () => {
      // Generator for valid CSS resource URLs (filter out URLs with quotes or parens)
      const cssUrlArbitrary = fc
        .oneof(
          // Relative paths
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
              fc.constantFrom(
                'css',
                'png',
                'jpg',
                'svg',
                'woff',
                'woff2',
                'ttf',
              ),
            )
            .map(([name, ext]) => `${name}.${ext}`),
          // Parent directory paths
          fc
            .tuple(
              fc.integer({ min: 1, max: 3 }),
              fc.stringMatching(/^[a-z0-9-]+$/),
              fc.constantFrom('css', 'png', 'jpg', 'woff'),
            )
            .map(([levels, name, ext]) => {
              const prefix = '../'.repeat(levels);
              return `${prefix}${name}.${ext}`;
            }),
          // Root-relative paths
          fc
            .tuple(
              fc.stringMatching(/^[a-z0-9-]+$/),
              fc.constantFrom('css', 'png', 'jpg', 'woff'),
            )
            .map(([name, ext]) => `/${name}.${ext}`),
          // Absolute URLs
          fc.webUrl({ validSchemes: ['http', 'https'] }),
        )
        .filter(url => !url.includes("'") && !url.includes('"'));

      // Generator for @import statements
      const importStatementArbitrary = fc
        .tuple(
          cssUrlArbitrary,
          fc.constantFrom(
            'quoted',
            'single-quoted',
            'url-quoted',
            'url-unquoted',
          ),
          fc.option(fc.constantFrom('print', 'screen', '(max-width: 600px)'), {
            nil: null,
          }),
        )
        .map(([url, format, media]) => {
          let statement = '';
          switch (format) {
            case 'quoted':
              statement = `@import "${url}"`;
              break;
            case 'single-quoted':
              statement = `@import '${url}'`;
              break;
            case 'url-quoted':
              statement = `@import url("${url}")`;
              break;
            case 'url-unquoted':
              statement = `@import url(${url})`;
              break;
          }
          if (media) {
            statement += ` ${media}`;
          }
          statement += ';';
          return { statement, url };
        });

      // Generator for url() functions in CSS rules
      const urlFunctionArbitrary = fc
        .tuple(
          cssUrlArbitrary,
          fc.constantFrom('quoted', 'single-quoted', 'unquoted'),
          fc.stringMatching(/^[a-z-]+$/),
        )
        .map(([url, format, property]) => {
          let urlFunc = '';
          switch (format) {
            case 'quoted':
              urlFunc = `url("${url}")`;
              break;
            case 'single-quoted':
              urlFunc = `url('${url}')`;
              break;
            case 'unquoted':
              urlFunc = `url(${url})`;
              break;
          }
          const rule = `.class { ${property}: ${urlFunc}; }`;
          return { rule, url };
        });

      // Generator for CSS documents with various resource types
      const cssDocumentArbitrary = fc
        .tuple(
          fc.array(importStatementArbitrary, { minLength: 0, maxLength: 3 }),
          fc.array(urlFunctionArbitrary, { minLength: 0, maxLength: 3 }),
        )
        .map(([imports, urlFuncs]) => {
          const importStatements = imports.map(i => i.statement).join('\n');
          const rules = urlFuncs.map(u => u.rule).join('\n');
          const allUrls = [
            ...imports.map(i => i.url),
            ...urlFuncs.map(u => u.url),
          ];
          return {
            css: importStatements + '\n' + rules,
            urls: allUrls,
          };
        });

      const baseUrlArbitrary = fc.webUrl({ validSchemes: ['http', 'https'] });

      fc.assert(
        fc.property(
          cssDocumentArbitrary,
          baseUrlArbitrary,
          ({ css, urls }, baseUrl) => {
            const result = parseCss(css, baseUrl);

            // Property: Result should have links array
            expect(Array.isArray(result.links)).toBe(true);

            // Property: Result should have baseUrl
            expect(result.baseUrl).toBe(baseUrl);

            // Property: All links should be strings
            result.links.forEach(link => {
              expect(typeof link).toBe('string');
            });

            // Property: All links should be non-empty
            result.links.forEach(link => {
              expect(link.length).toBeGreaterThan(0);
            });

            // Property: Links should be unique (no duplicates)
            const uniqueLinks = new Set(result.links);
            expect(uniqueLinks.size).toBe(result.links.length);

            // Property: All links should be valid URLs (absolute)
            result.links.forEach(link => {
              expect(() => new URL(link)).not.toThrow();
            });

            // Property: Number of extracted links should match unique URLs in CSS
            const uniqueUrls = new Set(urls);
            expect(result.links.length).toBe(uniqueUrls.size);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract all URLs from @import statements with various formats', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc
                .tuple(
                  fc.stringMatching(/^[a-z0-9-]+$/),
                  fc.constantFrom('css'),
                )
                .map(([name, ext]) => `${name}.${ext}`),
              fc.constantFrom(
                'quoted',
                'single-quoted',
                'url-quoted',
                'url-unquoted',
              ),
            ),
            { minLength: 1, maxLength: 5 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (urlFormatPairs, baseUrl) => {
            // Build CSS with known @import URLs
            const css = urlFormatPairs
              .map(([url, format]) => {
                switch (format) {
                  case 'quoted':
                    return `@import "${url}";`;
                  case 'single-quoted':
                    return `@import '${url}';`;
                  case 'url-quoted':
                    return `@import url("${url}");`;
                  case 'url-unquoted':
                    return `@import url(${url});`;
                }
              })
              .join('\n');

            const result = parseCss(css, baseUrl);

            // Property: All @import URLs should be extracted
            const uniqueUrls = new Set(urlFormatPairs.map(([url]) => url));
            expect(result.links.length).toBe(uniqueUrls.size);

            uniqueUrls.forEach(url => {
              const found = result.links.some(link => link.includes(url));
              expect(found).toBe(true);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract all URLs from url() functions with various formats', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc
                .tuple(
                  fc.stringMatching(/^[a-z0-9-]+$/),
                  fc.constantFrom('png', 'jpg', 'svg', 'woff', 'woff2'),
                )
                .map(([name, ext]) => `${name}.${ext}`),
              fc.constantFrom('quoted', 'single-quoted', 'unquoted'),
            ),
            { minLength: 1, maxLength: 5 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (urlFormatPairs, baseUrl) => {
            // Build CSS with known url() functions
            const css = urlFormatPairs
              .map(([url, format], idx) => {
                let urlFunc = '';
                switch (format) {
                  case 'quoted':
                    urlFunc = `url("${url}")`;
                    break;
                  case 'single-quoted':
                    urlFunc = `url('${url}')`;
                    break;
                  case 'unquoted':
                    urlFunc = `url(${url})`;
                    break;
                }
                return `.class${idx} { background: ${urlFunc}; }`;
              })
              .join('\n');

            const result = parseCss(css, baseUrl);

            // Property: All url() URLs should be extracted
            const uniqueUrls = new Set(urlFormatPairs.map(([url]) => url));
            expect(result.links.length).toBe(uniqueUrls.size);

            uniqueUrls.forEach(url => {
              const found = result.links.some(link => link.includes(url));
              expect(found).toBe(true);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract URLs from both @import and url() in the same CSS', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(
            fc
              .tuple(fc.stringMatching(/^[a-z0-9-]+$/), fc.constantFrom('css'))
              .map(([name, ext]) => `${name}.${ext}`),
            { minLength: 1, maxLength: 3 },
          ),
          fc.uniqueArray(
            fc
              .tuple(
                fc.stringMatching(/^[a-z0-9-]+$/),
                fc.constantFrom('png', 'jpg', 'svg'),
              )
              .map(([name, ext]) => `${name}.${ext}`),
            { minLength: 1, maxLength: 3 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (importUrls, urlFuncUrls, baseUrl) => {
            // Build CSS with both @import and url() functions
            const imports = importUrls
              .map(url => `@import "${url}";`)
              .join('\n');
            const rules = urlFuncUrls
              .map((url, idx) => `.class${idx} { background: url("${url}"); }`)
              .join('\n');
            const css = imports + '\n' + rules;

            const result = parseCss(css, baseUrl);

            // Property: All URLs from both @import and url() should be extracted
            const allUrls = [...importUrls, ...urlFuncUrls];
            expect(result.links.length).toBe(allUrls.length);

            allUrls.forEach(url => {
              const found = result.links.some(link => link.includes(url));
              expect(found).toBe(true);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should skip data: URLs in CSS', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom(
              'data:image/png;base64,abc',
              'data:image/svg+xml;base64,xyz',
              'data:font/woff2;base64,123',
            ),
            { minLength: 1, maxLength: 3 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (dataUrls, baseUrl) => {
            // Build CSS with data: URLs
            const css = dataUrls
              .map((url, idx) => `.class${idx} { background: url("${url}"); }`)
              .join('\n');

            const result = parseCss(css, baseUrl);

            // Property: data: URLs should not be extracted
            expect(result.links.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle @import with media queries', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc
                .tuple(
                  fc.stringMatching(/^[a-z0-9-]+$/),
                  fc.constantFrom('css'),
                )
                .map(([name, ext]) => `${name}.${ext}`),
              fc.constantFrom('print', 'screen', '(max-width: 600px)'),
            ),
            { minLength: 1, maxLength: 3 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (urlMediaPairs, baseUrl) => {
            // Build CSS with @import statements with media queries
            const css = urlMediaPairs
              .map(([url, media]) => `@import "${url}" ${media};`)
              .join('\n');

            const result = parseCss(css, baseUrl);

            // Property: All @import URLs with media queries should be extracted
            const uniqueUrls = new Set(urlMediaPairs.map(([url]) => url));
            expect(result.links.length).toBe(uniqueUrls.size);

            uniqueUrls.forEach(url => {
              const found = result.links.some(link => link.includes(url));
              expect(found).toBe(true);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle CSS with no URLs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.stringMatching(/^[a-z-]+$/),
              fc.stringMatching(/^[a-z-]+$/),
              fc.oneof(
                fc.stringMatching(/^[a-z]+$/),
                fc.integer({ min: 0, max: 100 }).map(n => `${n}px`),
                fc.constantFrom('red', 'blue', 'green', '#fff', '#000'),
              ),
            ),
            { minLength: 1, maxLength: 5 },
          ),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (rules, baseUrl) => {
            // Build CSS with no URLs
            const css = rules
              .map(
                ([selector, property, value]) =>
                  `.${selector} { ${property}: ${value}; }`,
              )
              .join('\n');

            const result = parseCss(css, baseUrl);

            // Property: CSS with no URLs should return empty links array
            expect(result.links.length).toBe(0);
            expect(result.baseUrl).toBe(baseUrl);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
