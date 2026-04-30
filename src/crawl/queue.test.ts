/**
 * Unit tests for DownloadQueue class
 */

import { DownloadQueue } from './queue';
import { QueuedResource } from '../types';

describe('DownloadQueue', () => {
  let queue: DownloadQueue;

  beforeEach(() => {
    queue = new DownloadQueue();
  });

  describe('enqueue and dequeue', () => {
    it('should enqueue and dequeue resources in FIFO order', () => {
      const resource1: QueuedResource = {
        url: 'https://example.com/page1',
        depth: 0,
        referrer: '',
      };
      const resource2: QueuedResource = {
        url: 'https://example.com/page2',
        depth: 1,
        referrer: 'https://example.com/page1',
      };

      queue.enqueue(resource1);
      queue.enqueue(resource2);

      expect(queue.dequeue()).toEqual(resource1);
      expect(queue.dequeue()).toEqual(resource2);
    });

    it('should return null when dequeuing from empty queue', () => {
      expect(queue.dequeue()).toBeNull();
    });

    it('should handle multiple enqueue and dequeue operations', () => {
      const resource1: QueuedResource = {
        url: 'https://example.com/page1',
        depth: 0,
        referrer: '',
      };
      const resource2: QueuedResource = {
        url: 'https://example.com/page2',
        depth: 1,
        referrer: 'https://example.com/page1',
      };

      queue.enqueue(resource1);
      expect(queue.dequeue()).toEqual(resource1);

      queue.enqueue(resource2);
      expect(queue.dequeue()).toEqual(resource2);
      expect(queue.dequeue()).toBeNull();
    });
  });

  describe('visited tracking', () => {
    it('should mark URLs as visited', () => {
      const url = 'https://example.com/page1';

      expect(queue.hasVisited(url)).toBe(false);
      queue.markVisited(url);
      expect(queue.hasVisited(url)).toBe(true);
    });

    it('should handle multiple URLs', () => {
      const url1 = 'https://example.com/page1';
      const url2 = 'https://example.com/page2';

      queue.markVisited(url1);
      queue.markVisited(url2);

      expect(queue.hasVisited(url1)).toBe(true);
      expect(queue.hasVisited(url2)).toBe(true);
      expect(queue.hasVisited('https://example.com/page3')).toBe(false);
    });

    it('should handle duplicate markVisited calls', () => {
      const url = 'https://example.com/page1';

      queue.markVisited(url);
      queue.markVisited(url);

      expect(queue.hasVisited(url)).toBe(true);
    });
  });

  describe('isEmpty', () => {
    it('should return true for new queue', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return false when queue has items', () => {
      queue.enqueue({
        url: 'https://example.com/page1',
        depth: 0,
        referrer: '',
      });

      expect(queue.isEmpty()).toBe(false);
    });

    it('should return true after all items are dequeued', () => {
      queue.enqueue({
        url: 'https://example.com/page1',
        depth: 0,
        referrer: '',
      });

      queue.dequeue();
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('size', () => {
    it('should return 0 for new queue', () => {
      expect(queue.size()).toBe(0);
    });

    it('should return correct size after enqueuing', () => {
      queue.enqueue({
        url: 'https://example.com/page1',
        depth: 0,
        referrer: '',
      });
      expect(queue.size()).toBe(1);

      queue.enqueue({
        url: 'https://example.com/page2',
        depth: 1,
        referrer: 'https://example.com/page1',
      });
      expect(queue.size()).toBe(2);
    });

    it('should return correct size after dequeuing', () => {
      queue.enqueue({
        url: 'https://example.com/page1',
        depth: 0,
        referrer: '',
      });
      queue.enqueue({
        url: 'https://example.com/page2',
        depth: 1,
        referrer: 'https://example.com/page1',
      });

      queue.dequeue();
      expect(queue.size()).toBe(1);

      queue.dequeue();
      expect(queue.size()).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    it('should prevent duplicate processing using visited tracking', () => {
      const url = 'https://example.com/page1';
      const resource: QueuedResource = {
        url,
        depth: 0,
        referrer: '',
      };

      // First time: not visited, should enqueue
      if (!queue.hasVisited(url)) {
        queue.enqueue(resource);
        queue.markVisited(url);
      }
      expect(queue.size()).toBe(1);

      // Second time: already visited, should not enqueue
      if (!queue.hasVisited(url)) {
        queue.enqueue(resource);
      }
      expect(queue.size()).toBe(1);
    });

    it('should handle typical scraping workflow', () => {
      // Start with initial URL
      const initialResource: QueuedResource = {
        url: 'https://example.com/',
        depth: 0,
        referrer: '',
      };

      queue.enqueue(initialResource);
      queue.markVisited(initialResource.url);

      // Process first resource
      const current = queue.dequeue();
      expect(current).toEqual(initialResource);

      // Discover new resources
      const discovered = [
        {
          url: 'https://example.com/page1',
          depth: 1,
          referrer: 'https://example.com/',
        },
        {
          url: 'https://example.com/page2',
          depth: 1,
          referrer: 'https://example.com/',
        },
        {
          url: 'https://example.com/',
          depth: 1,
          referrer: 'https://example.com/',
        }, // Duplicate
      ];

      // Add only unvisited resources
      discovered.forEach(resource => {
        if (!queue.hasVisited(resource.url)) {
          queue.enqueue(resource);
          queue.markVisited(resource.url);
        }
      });

      expect(queue.size()).toBe(2); // Only 2 new resources added
      expect(queue.hasVisited('https://example.com/')).toBe(true);
      expect(queue.hasVisited('https://example.com/page1')).toBe(true);
      expect(queue.hasVisited('https://example.com/page2')).toBe(true);
    });
  });
});
