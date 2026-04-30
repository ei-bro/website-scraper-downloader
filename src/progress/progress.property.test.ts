/**
 * Property-based tests for ProgressReporter
 * Feature: website-scraper-downloader
 * Tests Requirements 10.1, 10.2, 10.3, 10.4
 */

import * as fc from 'fast-check';
import type { ProgressStats } from '../types';
import { ProgressReporter } from './progress';

describe('ProgressReporter - Property-Based Tests', () => {
  /**
   * Property 16: Progress Accuracy
   * For any point during the download session, the displayed progress statistics
   * (discovered, downloaded, failed counts) should match the actual session state.
   * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
   */
  describe('Property 16: Progress Accuracy', () => {
    it('Feature: website-scraper-downloader, Property 16: Progress Accuracy', () => {
      // Generator for ProgressStats
      const progressStatsArbitrary = fc.record({
        discovered: fc.nat({ max: 10000 }),
        downloaded: fc.nat({ max: 10000 }),
        failed: fc.nat({ max: 1000 }),
        currentFile: fc.webUrl({ validSchemes: ['http', 'https'] }),
      });

      fc.assert(
        fc.property(progressStatsArbitrary, (stats) => {
          const reporter = new ProgressReporter();

          // Update the reporter with the stats
          reporter.update(stats);

          // Property: Retrieved stats should match the updated stats exactly
          const retrievedStats = reporter.getStats();
          expect(retrievedStats.discovered).toBe(stats.discovered);
          expect(retrievedStats.downloaded).toBe(stats.downloaded);
          expect(retrievedStats.failed).toBe(stats.failed);
          expect(retrievedStats.currentFile).toBe(stats.currentFile);

          // Property: Stats should be immutable (changes to input don't affect internal state)
          const originalDiscovered = stats.discovered;
          stats.discovered = 999999;
          const statsAfterMutation = reporter.getStats();
          expect(statsAfterMutation.discovered).toBe(originalDiscovered);
        }),
        { numRuns: 100 },
      );
    });

    it('should maintain accuracy across multiple updates', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discovered: fc.nat({ max: 10000 }),
              downloaded: fc.nat({ max: 10000 }),
              failed: fc.nat({ max: 1000 }),
              currentFile: fc.webUrl({ validSchemes: ['http', 'https'] }),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          (statsSequence) => {
            const reporter = new ProgressReporter();

            // Apply each stats update in sequence
            statsSequence.forEach((stats) => {
              reporter.update(stats);

              // Property: After each update, retrieved stats should match
              const retrievedStats = reporter.getStats();
              expect(retrievedStats.discovered).toBe(stats.discovered);
              expect(retrievedStats.downloaded).toBe(stats.downloaded);
              expect(retrievedStats.failed).toBe(stats.failed);
              expect(retrievedStats.currentFile).toBe(stats.currentFile);
            });

            // Property: Final state should match the last update
            const lastStats = statsSequence[statsSequence.length - 1];
            const finalStats = reporter.getStats();
            expect(finalStats.discovered).toBe(lastStats.discovered);
            expect(finalStats.downloaded).toBe(lastStats.downloaded);
            expect(finalStats.failed).toBe(lastStats.failed);
            expect(finalStats.currentFile).toBe(lastStats.currentFile);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should maintain accuracy with realistic download progression', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 1000 }),
          fc.nat({ max: 100 }),
          (totalDiscovered, failureCount) => {
            // Ensure downloaded + failed <= discovered
            const failed = Math.min(failureCount, totalDiscovered);
            const downloaded = fc.sample(fc.nat({ max: totalDiscovered - failed }), 1)[0];

            const stats: ProgressStats = {
              discovered: totalDiscovered,
              downloaded,
              failed,
              currentFile: 'https://example.com/file.html',
            };

            const reporter = new ProgressReporter();
            reporter.update(stats);

            // Property: Retrieved stats should match exactly
            const retrievedStats = reporter.getStats();
            expect(retrievedStats.discovered).toBe(totalDiscovered);
            expect(retrievedStats.downloaded).toBe(downloaded);
            expect(retrievedStats.failed).toBe(failed);

            // Property: Invariant - downloaded + failed should not exceed discovered
            expect(retrievedStats.downloaded + retrievedStats.failed).toBeLessThanOrEqual(
              retrievedStats.discovered,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve accuracy after reset', () => {
      fc.assert(
        fc.property(
          fc.record({
            discovered: fc.nat({ max: 10000 }),
            downloaded: fc.nat({ max: 10000 }),
            failed: fc.nat({ max: 1000 }),
            currentFile: fc.webUrl({ validSchemes: ['http', 'https'] }),
          }),
          fc.record({
            discovered: fc.nat({ max: 10000 }),
            downloaded: fc.nat({ max: 10000 }),
            failed: fc.nat({ max: 1000 }),
            currentFile: fc.webUrl({ validSchemes: ['http', 'https'] }),
          }),
          (stats1, stats2) => {
            const reporter = new ProgressReporter();

            // Update with first stats
            reporter.update(stats1);
            let retrievedStats = reporter.getStats();
            expect(retrievedStats.discovered).toBe(stats1.discovered);

            // Reset
            reporter.reset();
            retrievedStats = reporter.getStats();

            // Property: After reset, all stats should be zero/empty
            expect(retrievedStats.discovered).toBe(0);
            expect(retrievedStats.downloaded).toBe(0);
            expect(retrievedStats.failed).toBe(0);
            expect(retrievedStats.currentFile).toBe('');

            // Update with second stats
            reporter.update(stats2);
            retrievedStats = reporter.getStats();

            // Property: After reset and new update, stats should match second update
            expect(retrievedStats.discovered).toBe(stats2.discovered);
            expect(retrievedStats.downloaded).toBe(stats2.downloaded);
            expect(retrievedStats.failed).toBe(stats2.failed);
            expect(retrievedStats.currentFile).toBe(stats2.currentFile);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle edge cases with zero values', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { discovered: 0, downloaded: 0, failed: 0, currentFile: '' },
            {
              discovered: 100,
              downloaded: 0,
              failed: 0,
              currentFile: 'https://example.com/start.html',
            },
            {
              discovered: 100,
              downloaded: 100,
              failed: 0,
              currentFile: 'https://example.com/done.html',
            },
            {
              discovered: 100,
              downloaded: 0,
              failed: 100,
              currentFile: 'https://example.com/failed.html',
            },
          ),
          (stats) => {
            const reporter = new ProgressReporter();
            reporter.update(stats);

            // Property: Stats should be accurately retrieved even with zero values
            const retrievedStats = reporter.getStats();
            expect(retrievedStats.discovered).toBe(stats.discovered);
            expect(retrievedStats.downloaded).toBe(stats.downloaded);
            expect(retrievedStats.failed).toBe(stats.failed);
            expect(retrievedStats.currentFile).toBe(stats.currentFile);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should maintain accuracy with concurrent-like updates', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discovered: fc.nat({ max: 1000 }),
              downloaded: fc.nat({ max: 1000 }),
              failed: fc.nat({ max: 100 }),
              currentFile: fc.webUrl({ validSchemes: ['http', 'https'] }),
            }),
            { minLength: 10, maxLength: 50 },
          ),
          (statsSequence) => {
            const reporter = new ProgressReporter();

            // Simulate rapid updates (like in a real download session)
            statsSequence.forEach((stats) => {
              reporter.update(stats);
            });

            // Property: Final state should match the last update
            const lastStats = statsSequence[statsSequence.length - 1];
            const finalStats = reporter.getStats();
            expect(finalStats.discovered).toBe(lastStats.discovered);
            expect(finalStats.downloaded).toBe(lastStats.downloaded);
            expect(finalStats.failed).toBe(lastStats.failed);
            expect(finalStats.currentFile).toBe(lastStats.currentFile);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle special characters in currentFile', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 100 }),
          fc.nat({ max: 100 }),
          fc.nat({ max: 10 }),
          fc.string({ minLength: 0, maxLength: 500 }),
          (discovered, downloaded, failed, currentFile) => {
            const stats: ProgressStats = {
              discovered,
              downloaded,
              failed,
              currentFile,
            };

            const reporter = new ProgressReporter();
            reporter.update(stats);

            // Property: currentFile should be preserved exactly, including special characters
            const retrievedStats = reporter.getStats();
            expect(retrievedStats.currentFile).toBe(currentFile);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
