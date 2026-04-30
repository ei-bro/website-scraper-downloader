/**
 * Unit tests for domain filtering and depth tracking
 */

import { shouldDownloadUrl, shouldFollowLinks, shouldProcessDepth } from './filter';

describe('Domain Filtering', () => {
  describe('shouldDownloadUrl', () => {
    const targetDomain = 'example.com';

    describe('exact domain match', () => {
      it('should allow URL with exact domain match', () => {
        expect(shouldDownloadUrl('https://example.com/page', targetDomain, false)).toBe(true);
      });

      it('should allow URL with exact domain match regardless of subdomain setting', () => {
        expect(shouldDownloadUrl('https://example.com/page', targetDomain, true)).toBe(true);
      });
    });

    describe('different domain', () => {
      it('should reject URL from different domain when subdomains not included', () => {
        expect(shouldDownloadUrl('https://other.com/page', targetDomain, false)).toBe(false);
      });

      it('should reject URL from different domain when subdomains included', () => {
        expect(shouldDownloadUrl('https://other.com/page', targetDomain, true)).toBe(false);
      });
    });

    describe('subdomain handling', () => {
      it('should reject subdomain when includeSubdomains is false', () => {
        expect(shouldDownloadUrl('https://sub.example.com/page', targetDomain, false)).toBe(false);
      });

      it('should allow subdomain when includeSubdomains is true', () => {
        expect(shouldDownloadUrl('https://sub.example.com/page', targetDomain, true)).toBe(true);
      });

      it('should allow nested subdomain when includeSubdomains is true', () => {
        expect(shouldDownloadUrl('https://deep.sub.example.com/page', targetDomain, true)).toBe(
          true,
        );
      });

      it('should reject domain that contains target domain but is not a subdomain', () => {
        expect(shouldDownloadUrl('https://notexample.com/page', targetDomain, true)).toBe(false);
      });
    });

    describe('invalid URLs', () => {
      it('should reject invalid URL', () => {
        expect(shouldDownloadUrl('not-a-url', targetDomain, false)).toBe(false);
      });

      it('should reject empty URL', () => {
        expect(shouldDownloadUrl('', targetDomain, false)).toBe(false);
      });
    });
  });
});

describe('Depth Tracking', () => {
  describe('shouldProcessDepth', () => {
    it('should allow processing when maxDepth is null (unlimited)', () => {
      expect(shouldProcessDepth(0, null)).toBe(true);
      expect(shouldProcessDepth(100, null)).toBe(true);
      expect(shouldProcessDepth(1000, null)).toBe(true);
    });

    it('should allow processing when depth is less than maxDepth', () => {
      expect(shouldProcessDepth(0, 3)).toBe(true);
      expect(shouldProcessDepth(1, 3)).toBe(true);
      expect(shouldProcessDepth(2, 3)).toBe(true);
    });

    it('should allow processing when depth equals maxDepth', () => {
      expect(shouldProcessDepth(3, 3)).toBe(true);
    });

    it('should reject processing when depth exceeds maxDepth', () => {
      expect(shouldProcessDepth(4, 3)).toBe(false);
      expect(shouldProcessDepth(5, 3)).toBe(false);
    });

    it('should handle depth 0 correctly', () => {
      expect(shouldProcessDepth(0, 0)).toBe(true);
      expect(shouldProcessDepth(1, 0)).toBe(false);
    });
  });

  describe('shouldFollowLinks', () => {
    it('should allow following links when maxDepth is null (unlimited)', () => {
      expect(shouldFollowLinks(0, null)).toBe(true);
      expect(shouldFollowLinks(100, null)).toBe(true);
      expect(shouldFollowLinks(1000, null)).toBe(true);
    });

    it('should allow following links when depth is less than maxDepth', () => {
      expect(shouldFollowLinks(0, 3)).toBe(true);
      expect(shouldFollowLinks(1, 3)).toBe(true);
      expect(shouldFollowLinks(2, 3)).toBe(true);
    });

    it('should reject following links when depth equals maxDepth', () => {
      expect(shouldFollowLinks(3, 3)).toBe(false);
    });

    it('should reject following links when depth exceeds maxDepth', () => {
      expect(shouldFollowLinks(4, 3)).toBe(false);
      expect(shouldFollowLinks(5, 3)).toBe(false);
    });

    it('should handle depth 0 correctly', () => {
      expect(shouldFollowLinks(0, 0)).toBe(false);
    });
  });
});
