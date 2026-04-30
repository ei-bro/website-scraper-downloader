/**
 * Basic tests to verify type definitions and project setup
 */

import type { CLIOptions, QueuedResource, Resource, ScraperConfig } from './index';
import { ResourceType } from './index';

describe('Type Definitions', () => {
  describe('ResourceType enum', () => {
    it('should have all expected resource types', () => {
      expect(ResourceType.HTML).toBe('html');
      expect(ResourceType.CSS).toBe('css');
      expect(ResourceType.JavaScript).toBe('javascript');
      expect(ResourceType.Image).toBe('image');
      expect(ResourceType.Font).toBe('font');
      expect(ResourceType.Media).toBe('media');
      expect(ResourceType.Other).toBe('other');
    });
  });

  describe('Interface type checking', () => {
    it('should allow valid Resource objects', () => {
      const resource: Resource = {
        url: 'https://example.com/page.html',
        normalizedUrl: 'https://example.com/page.html',
        depth: 0,
        referrer: 'https://example.com',
        type: ResourceType.HTML,
        downloaded: false,
      };
      expect(resource.url).toBe('https://example.com/page.html');
    });

    it('should allow valid QueuedResource objects', () => {
      const queued: QueuedResource = {
        url: 'https://example.com/style.css',
        depth: 1,
        referrer: 'https://example.com/page.html',
      };
      expect(queued.depth).toBe(1);
    });

    it('should allow valid ScraperConfig objects', () => {
      const config: ScraperConfig = {
        maxRetries: 3,
        timeout: 30000,
        userAgent: 'Mozilla/5.0',
        maxConcurrent: 5,
        respectRobotsTxt: false,
      };
      expect(config.maxRetries).toBe(3);
    });

    it('should allow valid CLIOptions objects', () => {
      const options: CLIOptions = {
        url: 'https://example.com',
        output: './downloads',
        maxDepth: 3,
        includeSubdomains: false,
      };
      expect(options.url).toBe('https://example.com');
    });
  });
});
