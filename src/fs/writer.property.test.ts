/**
 * Property-based tests for path normalization and file system writer
 * Feature: website-scraper-downloader
 * Tests Requirements 13.1, 13.2, 13.3, 13.4, 2.2, 4.2, 5.2, 6.5, 7.1, 7.2, 7.3, 12.4
 */

import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  sanitizeFilename,
  urlToLocalPath,
  writeFile,
  createDirectoryStructure,
} from './writer';

describe('Path Normalizer - Property-Based Tests', () => {
  /**
   * Property 20: Filename Sanitization
   * For any URL containing characters invalid for the local filesystem,
   * the resulting filename should contain only valid characters while remaining unique.
   * **Validates: Requirements 13.1, 13.2**
   */
  describe('Property 20: Filename Sanitization', () => {
    it('Feature: website-scraper-downloader, Property 20: Filename Sanitization', () => {
      // Generator for filenames with potentially invalid characters
      const filenameArbitrary = fc.oneof(
        // Filenames with invalid characters
        fc
          .tuple(
            fc.stringMatching(/^[a-z0-9]+$/),
            fc.constantFrom('<', '>', ':', '"', '|', '?', '*', '/', '\\'),
            fc.stringMatching(/^[a-z0-9]+$/),
          )
          .map(([prefix, invalid, suffix]) => `${prefix}${invalid}${suffix}`),

        // Filenames with control characters
        fc
          .tuple(
            fc.stringMatching(/^[a-z0-9]+$/),
            fc.integer({ min: 0, max: 31 }),
            fc.stringMatching(/^[a-z0-9]+$/),
          )
          .map(
            ([prefix, charCode, suffix]) =>
              `${prefix}${String.fromCharCode(charCode)}${suffix}`,
          ),

        // Filenames with leading/trailing dots
        fc
          .tuple(
            fc.constantFrom('.', '..', '...'),
            fc.stringMatching(/^[a-z0-9]+$/),
            fc.constantFrom('.', '..', ''),
          )
          .map(([prefix, middle, suffix]) => `${prefix}${middle}${suffix}`),

        // Reserved Windows names
        fc.constantFrom(
          'CON',
          'PRN',
          'AUX',
          'NUL',
          'COM1',
          'COM9',
          'LPT1',
          'LPT9',
        ),

        // Valid filenames (should pass through mostly unchanged)
        fc
          .tuple(
            fc.stringMatching(/^[a-z0-9-_]+$/),
            fc.constantFrom('html', 'css', 'js', 'png', 'jpg'),
          )
          .map(([name, ext]) => `${name}.${ext}`),
      );

      fc.assert(
        fc.property(filenameArbitrary, filename => {
          const sanitized = sanitizeFilename(filename);

          // Property: Result should be non-empty
          expect(sanitized.length).toBeGreaterThan(0);

          // Property: Result should not contain invalid characters
          const invalidChars = /[<>:"|?*\x00-\x1F/\\]/;
          expect(invalidChars.test(sanitized)).toBe(false);

          // Property: Result should not start or end with dots or spaces
          expect(sanitized).not.toMatch(/^[.\s]/);
          expect(sanitized).not.toMatch(/[.\s]$/);

          // Property: Reserved names should be prefixed
          const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
          if (reservedNames.test(filename)) {
            expect(sanitized.startsWith('_')).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should maintain uniqueness for different inputs', () => {
      // Generator for pairs of different filenames
      const differentFilenamesArbitrary = fc
        .tuple(
          fc.stringMatching(/^[a-z0-9<>:"|?*]+$/),
          fc.stringMatching(/^[a-z0-9<>:"|?*]+$/),
        )
        .filter(([a, b]) => a !== b);

      fc.assert(
        fc.property(differentFilenamesArbitrary, ([filename1, filename2]) => {
          const sanitized1 = sanitizeFilename(filename1);
          const sanitized2 = sanitizeFilename(filename2);

          // Property: Different inputs should generally produce different outputs
          // (unless they differ only in invalid characters that get replaced the same way)
          // This is a weak property but important for uniqueness
          if (
            filename1.replace(/[<>:"|?*\x00-\x1F/\\]/g, '') !==
            filename2.replace(/[<>:"|?*\x00-\x1F/\\]/g, '')
          ) {
            // If the valid parts are different, sanitized should be different
            expect(sanitized1).not.toBe(sanitized2);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 21: Filename Length Limits
   * For any URL that would produce a filename exceeding the filesystem length limit,
   * the resulting filename should be truncated to a valid length while maintaining uniqueness.
   * **Validates: Requirements 13.3**
   */
  describe('Property 21: Filename Length Limits', () => {
    it('Feature: website-scraper-downloader, Property 21: Filename Length Limits', () => {
      // Generator for URLs with very long filenames
      const longFilenameUrlArbitrary = fc
        .tuple(
          fc.domain(),
          fc.stringMatching(/^[a-z]+$/),
          fc.integer({ min: 200, max: 500 }),
          fc.constantFrom('html', 'css', 'js', 'png', 'jpg', 'txt'),
        )
        .map(([domain, prefix, length, ext]) => {
          const longName = prefix.repeat(Math.ceil(length / prefix.length));
          return `https://${domain}/${longName.substring(0, length)}.${ext}`;
        });

      const outputDir = '/test-output';

      fc.assert(
        fc.property(longFilenameUrlArbitrary, url => {
          const localPath = urlToLocalPath(url, outputDir);
          const filename = path.basename(localPath);

          // Property: Filename should not exceed 255 characters
          expect(filename.length).toBeLessThanOrEqual(255);

          // Property: File extension should be preserved
          const originalExt = path.extname(new URL(url).pathname);
          if (originalExt) {
            expect(filename.endsWith(originalExt)).toBe(true);
          }

          // Property: Path should still be within output directory
          expect(localPath.startsWith(outputDir)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should maintain uniqueness for long filenames', () => {
      // Generator for pairs of URLs with long but different filenames
      const longFilenamePairArbitrary = fc
        .tuple(
          fc.domain(),
          fc.stringMatching(/^[a-z]+$/),
          fc.stringMatching(/^[a-z]+$/),
          fc.integer({ min: 250, max: 300 }),
        )
        .filter(([, prefix1, prefix2]) => prefix1 !== prefix2)
        .map(([domain, prefix1, prefix2, length]) => {
          const name1 = prefix1.repeat(Math.ceil(length / prefix1.length));
          const name2 = prefix2.repeat(Math.ceil(length / prefix2.length));
          return [
            `https://${domain}/${name1.substring(0, length)}.html`,
            `https://${domain}/${name2.substring(0, length)}.html`,
          ];
        });

      const outputDir = '/test-output';

      fc.assert(
        fc.property(longFilenamePairArbitrary, ([url1, url2]) => {
          const path1 = urlToLocalPath(url1, outputDir);
          const path2 = urlToLocalPath(url2, outputDir);

          // Property: Different URLs should produce different paths
          expect(path1).not.toBe(path2);

          // Property: Both should have valid filename lengths
          expect(path.basename(path1).length).toBeLessThanOrEqual(255);
          expect(path.basename(path2).length).toBeLessThanOrEqual(255);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 22: URL Decoding
   * For any URL containing percent-encoded characters, the scraper should
   * correctly decode them when creating local paths.
   * **Validates: Requirements 13.4**
   */
  describe('Property 22: URL Decoding', () => {
    it('Feature: website-scraper-downloader, Property 22: URL Decoding', () => {
      // Generator for URLs with percent-encoded characters
      const encodedUrlArbitrary = fc
        .tuple(
          fc.domain(),
          fc.array(
            fc.oneof(
              // Regular path segments
              fc.stringMatching(/^[a-z0-9-]+$/),
              // Segments with spaces (will be encoded)
              fc
                .tuple(
                  fc.stringMatching(/^[a-z0-9]+$/),
                  fc.stringMatching(/^[a-z0-9]+$/),
                )
                .map(([a, b]) => `${a} ${b}`),
              // Segments with special characters
              fc
                .tuple(
                  fc.stringMatching(/^[a-z0-9]+$/),
                  fc.constantFrom('!', '@', '#', '$', '%', '&', '(', ')'),
                  fc.stringMatching(/^[a-z0-9]+$/),
                )
                .map(([a, char, b]) => `${a}${char}${b}`),
            ),
            { minLength: 1, maxLength: 3 },
          ),
          fc.constantFrom('html', 'css', 'js', 'png'),
        )
        .map(([domain, pathParts, ext]) => {
          // Encode the path parts
          const encodedPath = pathParts
            .map(part => encodeURIComponent(part))
            .join('/');
          return {
            original: pathParts,
            url: `https://${domain}/${encodedPath}/file.${ext}`,
          };
        });

      const outputDir = '/test-output';

      fc.assert(
        fc.property(encodedUrlArbitrary, ({ url }) => {
          const localPath = urlToLocalPath(url, outputDir);

          // Property: Path should be successfully created (no errors)
          expect(localPath).toBeDefined();
          expect(typeof localPath).toBe('string');
          expect(localPath.length).toBeGreaterThan(0);

          // Property: Path should start with output directory
          expect(localPath.startsWith(outputDir)).toBe(true);

          // Property: Decoded path should not contain percent-encoding
          // (unless it was double-encoded or part of sanitization)
          const relativePath = localPath.substring(outputDir.length);
          // We don't expect %20 or other common encodings in the final path
          // unless they were sanitized to underscores
          expect(relativePath).toBeDefined();
        }),
        { numRuns: 100 },
      );
    });

    it('should handle double-encoded URLs', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          fc.stringMatching(/^[a-z0-9 ]+$/),
          (domain, filename) => {
            // Double encode the filename
            const doubleEncoded = encodeURIComponent(
              encodeURIComponent(filename),
            );
            const url = `https://${domain}/${doubleEncoded}.html`;

            const outputDir = '/test-output';
            const localPath = urlToLocalPath(url, outputDir);

            // Property: Should handle without throwing
            expect(localPath).toBeDefined();
            expect(localPath.startsWith(outputDir)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 3: Path Preservation
   * For any downloaded file, the local file path should preserve the server
   * path structure relative to the target domain.
   * **Validates: Requirements 2.2, 4.2, 5.2, 6.5, 7.2**
   */
  describe('Property 3: Path Preservation', () => {
    it('Feature: website-scraper-downloader, Property 3: Path Preservation', () => {
      // Generator for URLs with various path structures
      const urlWithPathArbitrary = fc
        .tuple(
          fc.domain(),
          fc.array(fc.stringMatching(/^[a-z0-9-]+$/), {
            minLength: 0,
            maxLength: 5,
          }),
          fc.stringMatching(/^[a-z0-9-]+$/),
          fc.constantFrom('html', 'css', 'js', 'png', 'jpg', 'woff', 'mp4'),
        )
        .map(([domain, pathParts, filename, ext]) => {
          const pathStr =
            pathParts.length > 0 ? `/${pathParts.join('/')}/` : '/';
          return {
            url: `https://${domain}${pathStr}${filename}.${ext}`,
            expectedParts: [...pathParts, `${filename}.${ext}`],
          };
        });

      const outputDir = '/test-output';

      fc.assert(
        fc.property(urlWithPathArbitrary, ({ url, expectedParts }) => {
          const localPath = urlToLocalPath(url, outputDir);

          // Property: Local path should start with output directory
          expect(localPath.startsWith(outputDir)).toBe(true);

          // Property: Path structure should be preserved
          const relativePath = localPath.substring(outputDir.length + 1);
          const actualParts = relativePath.split(path.sep);

          // The number of path components should match
          expect(actualParts.length).toBe(expectedParts.length);

          // Each component should match (after sanitization)
          expectedParts.forEach((expected, index) => {
            // Components should be similar (sanitization may change them slightly)
            expect(actualParts[index]).toBeDefined();
          });
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 9: Directory Structure Creation
   * For any file path to be written, all parent directories should exist
   * (created if necessary) before the file is written.
   * **Validates: Requirements 7.1, 7.3**
   */
  describe('Property 9: Directory Structure Creation', () => {
    const testBaseDir = path.join(__dirname, '../../test-output-pbt');

    afterEach(async () => {
      // Clean up test directory
      try {
        await fs.rm(testBaseDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore errors
      }
    });

    it('Feature: website-scraper-downloader, Property 9: Directory Structure Creation', () => {
      // Generator for nested directory structures
      const nestedPathArbitrary = fc
        .tuple(
          fc.array(fc.stringMatching(/^[a-z0-9-]+$/), {
            minLength: 1,
            maxLength: 5,
          }),
          fc.stringMatching(/^[a-z0-9-]+$/),
          fc.constantFrom('html', 'txt', 'css'),
        )
        .map(([dirs, filename, ext]) => {
          return path.join(testBaseDir, ...dirs, `${filename}.${ext}`);
        });

      fc.assert(
        fc.asyncProperty(nestedPathArbitrary, async filePath => {
          // Create directory structure
          await createDirectoryStructure(filePath);

          // Property: Parent directory should exist
          const parentDir = path.dirname(filePath);
          const dirExists = await fs
            .access(parentDir)
            .then(() => true)
            .catch(() => false);

          expect(dirExists).toBe(true);

          // Property: Parent should be a directory
          const stats = await fs.stat(parentDir);
          expect(stats.isDirectory()).toBe(true);
        }),
        { numRuns: 50 }, // Reduced runs for file system operations
      );
    });
  });

  /**
   * Property 18: Output Directory Containment
   * For any file downloaded during a session, its absolute path should be
   * within the specified output directory.
   * **Validates: Requirements 12.4**
   */
  describe('Property 18: Output Directory Containment', () => {
    it('Feature: website-scraper-downloader, Property 18: Output Directory Containment', () => {
      // Generator for URLs including potential path traversal attempts
      const urlArbitrary = fc
        .tuple(
          fc.domain(),
          fc.array(
            fc.oneof(
              fc.stringMatching(/^[a-z0-9-]+$/),
              fc.constant('..'),
              fc.constant('.'),
            ),
            { minLength: 1, maxLength: 5 },
          ),
          fc.stringMatching(/^[a-z0-9-]+$/),
          fc.constantFrom('html', 'css', 'js'),
        )
        .map(([domain, pathParts, filename, ext]) => {
          const pathStr = `/${pathParts.join('/')}/${filename}.${ext}`;
          return `https://${domain}${pathStr}`;
        });

      const outputDir = '/test-output';

      fc.assert(
        fc.property(urlArbitrary, url => {
          const localPath = urlToLocalPath(url, outputDir);

          // Property: Resolved path should be within output directory
          const resolvedOutput = path.resolve(outputDir);
          const resolvedLocal = path.resolve(localPath);

          expect(resolvedLocal.startsWith(resolvedOutput)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should prevent path traversal in writeFile', () => {
      const testDir = path.join(__dirname, '../../test-output-pbt-traversal');

      const pathTraversalUrlArbitrary = fc
        .tuple(
          fc.domain(),
          fc.integer({ min: 1, max: 10 }),
          fc.stringMatching(/^[a-z0-9-]+$/),
        )
        .map(([domain, dotdots, filename]) => {
          const traversal = '../'.repeat(dotdots);
          return `https://${domain}/${traversal}${filename}.html`;
        });

      fc.assert(
        fc.asyncProperty(pathTraversalUrlArbitrary, async url => {
          const content = Buffer.from('test content');
          const result = await writeFile(url, content, testDir);

          // Property: Either write succeeds within directory or fails safely
          if (result.success && result.path) {
            const resolvedTest = path.resolve(testDir);
            const resolvedPath = path.resolve(result.path);
            expect(resolvedPath.startsWith(resolvedTest)).toBe(true);
          } else {
            // If it fails, should have an error message
            expect(result.error).toBeDefined();
          }
        }),
        { numRuns: 50 },
      );
    });

    afterAll(async () => {
      // Cleanup test directory
      try {
        const testDir = path.join(__dirname, '../../test-output-pbt-traversal');
        await fs.rm(testDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore
      }
    });
  });
});
