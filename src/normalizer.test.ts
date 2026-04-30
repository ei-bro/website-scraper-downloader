/**
 * Unit tests for URL normalization functions
 * Tests: normalizeUrl and resolveRelativeUrl
 */

import { normalizeUrl, resolveRelativeUrl } from './validator';

describe('normalizeUrl', () => {
  it('should normalize hostname to lowercase', () => {
    const result = normalizeUrl('https://EXAMPLE.COM/path');
    expect(result).toBe('https://example.com/path');
  });

  it('should remove trailing slash from non-root paths', () => {
    const result = normalizeUrl('https://example.com/path/');
    expect(result).toBe('https://example.com/path');
  });

  it('should preserve trailing slash for root path', () => {
    const result = normalizeUrl('https://example.com/');
    expect(result).toBe('https://example.com/');
  });

  it('should remove default port 80 for http', () => {
    const result = normalizeUrl('http://example.com:80/path');
    expect(result).toBe('http://example.com/path');
  });

  it('should remove default port 443 for https', () => {
    const result = normalizeUrl('https://example.com:443/path');
    expect(result).toBe('https://example.com/path');
  });

  it('should preserve non-default ports', () => {
    const result = normalizeUrl('https://example.com:8080/path');
    expect(result).toBe('https://example.com:8080/path');
  });

  it('should sort query parameters alphabetically', () => {
    const result = normalizeUrl('https://example.com/path?z=1&a=2&m=3');
    expect(result).toBe('https://example.com/path?a=2&m=3&z=1');
  });

  it('should remove fragment identifiers', () => {
    const result = normalizeUrl('https://example.com/path#section');
    expect(result).toBe('https://example.com/path');
  });

  it('should handle complex URLs with all features', () => {
    const result = normalizeUrl(
      'https://EXAMPLE.COM:443/path/?z=1&a=2#section',
    );
    expect(result).toBe('https://example.com/path?a=2&z=1');
  });

  it('should be idempotent', () => {
    const url = 'https://EXAMPLE.COM:443/path/?z=1&a=2#section';
    const normalized1 = normalizeUrl(url);
    const normalized2 = normalizeUrl(normalized1);
    expect(normalized1).toBe(normalized2);
  });

  it('should throw error for invalid URL', () => {
    expect(() => normalizeUrl('not a url')).toThrow();
  });
});

describe('resolveRelativeUrl', () => {
  it('should resolve relative path against base URL', () => {
    const result = resolveRelativeUrl(
      'https://example.com/dir/page.html',
      'image.png',
    );
    expect(result).toBe('https://example.com/dir/image.png');
  });

  it('should resolve parent directory reference', () => {
    const result = resolveRelativeUrl(
      'https://example.com/dir/subdir/page.html',
      '../image.png',
    );
    expect(result).toBe('https://example.com/dir/image.png');
  });

  it('should resolve root-relative path', () => {
    const result = resolveRelativeUrl(
      'https://example.com/dir/page.html',
      '/assets/image.png',
    );
    expect(result).toBe('https://example.com/assets/image.png');
  });

  it('should return absolute URL unchanged', () => {
    const absoluteUrl = 'https://other.com/image.png';
    const result = resolveRelativeUrl(
      'https://example.com/page.html',
      absoluteUrl,
    );
    expect(result).toBe(absoluteUrl);
  });

  it('should handle query parameters in relative URL', () => {
    const result = resolveRelativeUrl(
      'https://example.com/page.html',
      'api?param=value',
    );
    expect(result).toBe('https://example.com/api?param=value');
  });

  it('should handle fragment in relative URL', () => {
    const result = resolveRelativeUrl(
      'https://example.com/page.html',
      'other.html#section',
    );
    expect(result).toBe('https://example.com/other.html#section');
  });

  it('should resolve current directory reference', () => {
    const result = resolveRelativeUrl(
      'https://example.com/dir/page.html',
      './image.png',
    );
    expect(result).toBe('https://example.com/dir/image.png');
  });

  it('should handle protocol-relative URLs', () => {
    const result = resolveRelativeUrl(
      'https://example.com/page.html',
      '//other.com/image.png',
    );
    expect(result).toBe('https://other.com/image.png');
  });

  it('should throw error for invalid base URL', () => {
    expect(() => resolveRelativeUrl('not a url', 'image.png')).toThrow();
  });

  it('should handle empty relative URL', () => {
    const result = resolveRelativeUrl('https://example.com/page.html', '');
    expect(result).toBe('https://example.com/page.html');
  });
});
