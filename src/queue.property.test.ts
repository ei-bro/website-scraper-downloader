/**
 * Property-based tests for DownloadQueue behavior
 * Feature: website-scraper-downloader
 * Tests Requirements 3.5, 8.4
 */

import * as fc from 'fast-check';
import { DownloadQueue } from './queue';
import { QueuedResource } from './types';

describe('DownloadQueue - Property-Based Tests', () => {
  /**
   * Property 6: Discovered Resources Queued
   * For any resource URL discovered during parsing, it should be added to the
   * download queue if it hasn't been visited and passes domain/depth filters.
   * **Validates: Requirements 3.5**
   */
  describe('Property 6: Discovered Resources Queued', () => {
    it('Feature: website-scraper-downloader, Property 6: Discovered Resources Queued', () => {
      // Generator for QueuedResource
      const queuedResourceArbitrary = fc.record({
        url: fc.webUrl({ validSchemes: ['http', 'https'] }),
        depth: fc.nat({ max: 10 }),
        referrer: fc.webUrl({ validSchemes: ['http', 'https'] }),
      });

      // Generator for arrays of discovered resources
      const discoveredResourcesArbitrary = fc.array(queuedResourceArbitrary, {
        minLength: 1,
        maxLength: 20,
      });

      fc.assert(
        fc.property(discoveredResourcesArbitrary, discoveredResources => {
          const queue = new DownloadQueue();
          const expectedInQueue: QueuedResource[] = [];

          // Simulate discovery and queueing logic
          discoveredResources.forEach(resource => {
            // Only enqueue if not visited (simulating domain/depth filter pass)
            if (!queue.hasVisited(resource.url)) {
              queue.enqueue(resource);
              queue.markVisited(resource.url);
              expectedInQueue.push(resource);
            }
          });

          // Property: Queue size should match number of unique URLs enqueued
          expect(queue.size()).toBe(expectedInQueue.length);

          // Property: All enqueued resources should be dequeued in FIFO order
          expectedInQueue.forEach(expectedResource => {
            const dequeued = queue.dequeue();
            expect(dequeued).not.toBeNull();
            expect(dequeued?.url).toBe(expectedResource.url);
            expect(dequeued?.depth).toBe(expectedResource.depth);
            expect(dequeued?.referrer).toBe(expectedResource.referrer);
          });

          // Property: Queue should be empty after all resources are dequeued
          expect(queue.isEmpty()).toBe(true);
          expect(queue.dequeue()).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should handle resources with varying depths', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              url: fc.webUrl({ validSchemes: ['http', 'https'] }),
              depth: fc.integer({ min: 0, max: 100 }),
              referrer: fc.webUrl({ validSchemes: ['http', 'https'] }),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          resources => {
            const queue = new DownloadQueue();

            // Enqueue all resources
            resources.forEach(resource => {
              if (!queue.hasVisited(resource.url)) {
                queue.enqueue(resource);
                queue.markVisited(resource.url);
              }
            });

            // Property: All dequeued resources should maintain their depth values
            let dequeued = queue.dequeue();
            let count = 0;
            while (dequeued !== null) {
              expect(typeof dequeued.depth).toBe('number');
              expect(dequeued.depth).toBeGreaterThanOrEqual(0);
              count++;
              dequeued = queue.dequeue();
            }

            // Property: Number of dequeued items should match unique URLs
            const uniqueUrls = new Set(resources.map(r => r.url));
            expect(count).toBe(uniqueUrls.size);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve resource metadata through queue operations', () => {
      fc.assert(
        fc.property(
          fc.record({
            url: fc.webUrl({ validSchemes: ['http', 'https'] }),
            depth: fc.nat({ max: 10 }),
            referrer: fc.webUrl({ validSchemes: ['http', 'https'] }),
          }),
          resource => {
            const queue = new DownloadQueue();

            queue.enqueue(resource);
            const dequeued = queue.dequeue();

            // Property: Dequeued resource should match enqueued resource exactly
            expect(dequeued).not.toBeNull();
            expect(dequeued?.url).toBe(resource.url);
            expect(dequeued?.depth).toBe(resource.depth);
            expect(dequeued?.referrer).toBe(resource.referrer);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 13: Duplicate Prevention
   * For any URL that has already been downloaded, attempting to queue it again
   * should result in it being skipped.
   * **Validates: Requirements 8.4**
   */
  describe('Property 13: Duplicate Prevention', () => {
    it('Feature: website-scraper-downloader, Property 13: Duplicate Prevention', () => {
      // Generator for arrays of resources with intentional duplicates
      const resourcesWithDuplicatesArbitrary = fc
        .array(
          fc.record({
            url: fc.webUrl({ validSchemes: ['http', 'https'] }),
            depth: fc.nat({ max: 10 }),
            referrer: fc.webUrl({ validSchemes: ['http', 'https'] }),
          }),
          { minLength: 2, maxLength: 20 },
        )
        .chain(resources => {
          // Randomly duplicate some resources
          return fc
            .array(fc.integer({ min: 0, max: resources.length - 1 }), {
              minLength: 0,
              maxLength: 5,
            })
            .map(duplicateIndices => {
              const withDuplicates = [...resources];
              duplicateIndices.forEach(idx => {
                withDuplicates.push(resources[idx]);
              });
              return withDuplicates;
            });
        });

      fc.assert(
        fc.property(resourcesWithDuplicatesArbitrary, resources => {
          const queue = new DownloadQueue();
          const uniqueUrls = new Set<string>();

          // Simulate the duplicate prevention logic
          resources.forEach(resource => {
            if (!queue.hasVisited(resource.url)) {
              queue.enqueue(resource);
              queue.markVisited(resource.url);
              uniqueUrls.add(resource.url);
            }
          });

          // Property: Queue size should equal number of unique URLs
          expect(queue.size()).toBe(uniqueUrls.size);

          // Property: All URLs should be marked as visited
          uniqueUrls.forEach(url => {
            expect(queue.hasVisited(url)).toBe(true);
          });

          // Property: Attempting to check visited status for duplicate URLs returns true
          resources.forEach(resource => {
            expect(queue.hasVisited(resource.url)).toBe(true);
          });

          // Property: Dequeuing should yield exactly the number of unique URLs
          let dequeuedCount = 0;
          while (!queue.isEmpty()) {
            const dequeued = queue.dequeue();
            expect(dequeued).not.toBeNull();
            dequeuedCount++;
          }
          expect(dequeuedCount).toBe(uniqueUrls.size);
        }),
        { numRuns: 100 },
      );
    });

    it('should prevent duplicates across multiple enqueue operations', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.nat({ max: 10 }),
          fc.integer({ min: 2, max: 10 }),
          (url, depth, repeatCount) => {
            const queue = new DownloadQueue();
            const resource: QueuedResource = {
              url,
              depth,
              referrer: 'https://example.com',
            };

            // Try to enqueue the same resource multiple times
            for (let i = 0; i < repeatCount; i++) {
              if (!queue.hasVisited(resource.url)) {
                queue.enqueue(resource);
                queue.markVisited(resource.url);
              }
            }

            // Property: Queue should contain exactly one instance
            expect(queue.size()).toBe(1);

            // Property: URL should be marked as visited
            expect(queue.hasVisited(url)).toBe(true);

            // Property: Only one resource should be dequeued
            const dequeued = queue.dequeue();
            expect(dequeued).not.toBeNull();
            expect(dequeued?.url).toBe(url);
            expect(queue.isEmpty()).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle visited tracking independently of queue state', () => {
      fc.assert(
        fc.property(
          fc.array(fc.webUrl({ validSchemes: ['http', 'https'] }), {
            minLength: 1,
            maxLength: 10,
          }),
          urls => {
            const queue = new DownloadQueue();

            // Mark some URLs as visited without enqueuing
            urls.forEach(url => {
              queue.markVisited(url);
            });

            // Property: All URLs should be marked as visited
            urls.forEach(url => {
              expect(queue.hasVisited(url)).toBe(true);
            });

            // Property: Queue should be empty (nothing was enqueued)
            expect(queue.isEmpty()).toBe(true);
            expect(queue.size()).toBe(0);

            // Property: Attempting to enqueue visited URLs should be skipped
            urls.forEach(url => {
              if (!queue.hasVisited(url)) {
                queue.enqueue({
                  url,
                  depth: 0,
                  referrer: 'https://example.com',
                });
              }
            });

            // Property: Queue should still be empty
            expect(queue.isEmpty()).toBe(true);
            expect(queue.size()).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should maintain visited state after dequeuing', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              url: fc.webUrl({ validSchemes: ['http', 'https'] }),
              depth: fc.nat({ max: 10 }),
              referrer: fc.webUrl({ validSchemes: ['http', 'https'] }),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          resources => {
            const queue = new DownloadQueue();
            const visitedUrls: string[] = [];

            // Enqueue and mark as visited
            resources.forEach(resource => {
              if (!queue.hasVisited(resource.url)) {
                queue.enqueue(resource);
                queue.markVisited(resource.url);
                visitedUrls.push(resource.url);
              }
            });

            // Dequeue all resources
            while (!queue.isEmpty()) {
              queue.dequeue();
            }

            // Property: All URLs should still be marked as visited after dequeuing
            visitedUrls.forEach(url => {
              expect(queue.hasVisited(url)).toBe(true);
            });

            // Property: Attempting to re-enqueue should be prevented
            resources.forEach(resource => {
              if (!queue.hasVisited(resource.url)) {
                queue.enqueue(resource);
              }
            });

            // Property: Queue should remain empty
            expect(queue.isEmpty()).toBe(true);
            expect(queue.size()).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
