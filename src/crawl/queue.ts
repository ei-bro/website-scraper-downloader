/**
 * Download Queue Manager
 * Maintains the queue of URLs to download and tracks visited URLs
 */

import type { QueuedResource } from '../types';

/**
 * Manages the download queue and tracks visited URLs to prevent duplicates
 */
export class DownloadQueue {
  private queue: QueuedResource[] = [];
  private visited: Set<string> = new Set();

  /**
   * Add a resource to the download queue
   * @param resource - The resource to enqueue
   */
  enqueue(resource: QueuedResource): void {
    this.queue.push(resource);
  }

  /**
   * Remove and return the next resource from the queue
   * @returns The next resource or null if queue is empty
   */
  dequeue(): QueuedResource | null {
    if (this.queue.length === 0) {
      return null;
    }
    return this.queue.shift() || null;
  }

  /**
   * Mark a URL as visited
   * @param url - The URL to mark as visited
   */
  markVisited(url: string): void {
    this.visited.add(url);
  }

  /**
   * Check if a URL has been visited
   * @param url - The URL to check
   * @returns True if the URL has been visited, false otherwise
   */
  hasVisited(url: string): boolean {
    return this.visited.has(url);
  }

  /**
   * Check if the queue is empty
   * @returns True if the queue is empty, false otherwise
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get the current size of the queue
   * @returns The number of resources in the queue
   */
  size(): number {
    return this.queue.length;
  }
}
