/**
 * Unit tests for HTML parser
 */

import { parseHtml, parseCss } from './parser';

describe('parseHtml', () => {
  const baseUrl = 'https://example.com/page.html';

  it('should extract URLs from anchor tags with href', () => {
    const html = '<a href="https://example.com/link1">Link</a>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/link1');
  });

  it('should extract URLs from link tags with href', () => {
    const html = '<link rel="stylesheet" href="/styles.css">';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/styles.css');
  });

  it('should extract URLs from script tags with src', () => {
    const html = '<script src="/js/app.js"></script>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/js/app.js');
  });

  it('should extract URLs from img tags with src', () => {
    const html = '<img src="images/photo.jpg" alt="Photo">';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/images/photo.jpg');
  });

  it('should extract URLs from iframe tags with src', () => {
    const html = '<iframe src="https://example.com/embed"></iframe>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/embed');
  });

  it('should extract URLs from source tags with src', () => {
    const html = '<source src="video.mp4" type="video/mp4">';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/video.mp4');
  });

  it('should extract URLs from style attributes', () => {
    const html = '<div style="background-image: url(bg.png)">Content</div>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/bg.png');
  });

  it('should extract URLs from style tags', () => {
    const html = '<style>.class { background: url("/images/bg.jpg"); }</style>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/images/bg.jpg');
  });

  it('should resolve relative URLs', () => {
    const html = '<a href="subdir/page.html">Link</a>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/subdir/page.html');
  });

  it('should skip fragment-only links', () => {
    const html = '<a href="#section">Section</a>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).not.toContain('#section');
  });

  it('should skip javascript: links', () => {
    const html = '<a href="javascript:void(0)">Click</a>';
    const result = parseHtml(html, baseUrl);
    expect(result.links.length).toBe(0);
  });

  it('should skip mailto: links', () => {
    const html = '<a href="mailto:test@example.com">Email</a>';
    const result = parseHtml(html, baseUrl);
    expect(result.links.length).toBe(0);
  });

  it('should skip data: URLs in CSS', () => {
    const html =
      '<style>.class { background: url("data:image/png;base64,abc"); }</style>';
    const result = parseHtml(html, baseUrl);
    expect(result.links.length).toBe(0);
  });

  it('should deduplicate URLs', () => {
    const html = `
      <a href="/page">Link1</a>
      <a href="/page">Link2</a>
      <img src="/page">
    `;
    const result = parseHtml(html, baseUrl);
    const pageLinks = result.links.filter(
      link => link === 'https://example.com/page',
    );
    expect(pageLinks.length).toBe(1);
  });

  it('should handle multiple resource types in one document', () => {
    const html = `
      <link rel="stylesheet" href="styles.css">
      <script src="app.js"></script>
      <img src="logo.png">
      <a href="about.html">About</a>
      <style>.bg { background: url(bg.jpg); }</style>
    `;
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/styles.css');
    expect(result.links).toContain('https://example.com/app.js');
    expect(result.links).toContain('https://example.com/logo.png');
    expect(result.links).toContain('https://example.com/about.html');
    expect(result.links).toContain('https://example.com/bg.jpg');
  });

  it('should handle URLs with single quotes', () => {
    const html = "<a href='page.html'>Link</a>";
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/page.html');
  });

  it('should handle URLs with query parameters', () => {
    const html = '<a href="page.html?id=123&sort=asc">Link</a>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain(
      'https://example.com/page.html?id=123&sort=asc',
    );
  });

  it('should return baseUrl in result', () => {
    const html = '<a href="page.html">Link</a>';
    const result = parseHtml(html, baseUrl);
    expect(result.baseUrl).toBe(baseUrl);
  });

  it('should handle empty HTML', () => {
    const html = '';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toEqual([]);
    expect(result.baseUrl).toBe(baseUrl);
  });

  it('should handle HTML with no links', () => {
    const html = '<div>Just text content</div>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toEqual([]);
  });

  it('should handle malformed HTML gracefully', () => {
    const html = '<a href="page.html">Unclosed tag';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/page.html');
  });

  it('should handle CSS url() with quotes', () => {
    const html = '<style>.class { background: url("image.png"); }</style>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/image.png');
  });

  it('should handle CSS url() without quotes', () => {
    const html = '<style>.class { background: url(image.png); }</style>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/image.png');
  });

  it('should handle multiple URLs in style attribute', () => {
    const html =
      '<div style="background: url(bg1.png), url(bg2.png)">Content</div>';
    const result = parseHtml(html, baseUrl);
    expect(result.links).toContain('https://example.com/bg1.png');
    expect(result.links).toContain('https://example.com/bg2.png');
  });
});

describe('parseCss', () => {
  const baseUrl = 'https://example.com/styles/main.css';

  it('should extract URLs from @import statements with quotes', () => {
    const css = '@import "other.css";';
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://example.com/styles/other.css');
  });

  it('should extract URLs from @import statements with single quotes', () => {
    const css = "@import 'other.css';";
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://example.com/styles/other.css');
  });

  it('should extract URLs from @import url() with quotes', () => {
    const css = '@import url("other.css");';
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://example.com/styles/other.css');
  });

  it('should extract URLs from @import url() without quotes', () => {
    const css = '@import url(other.css);';
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://example.com/styles/other.css');
  });

  it('should extract URLs from url() functions', () => {
    const css = '.class { background: url("image.png"); }';
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://example.com/styles/image.png');
  });

  it('should extract URLs from url() without quotes', () => {
    const css = '.class { background: url(image.png); }';
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://example.com/styles/image.png');
  });

  it('should extract multiple URLs from CSS', () => {
    const css = `
      @import "reset.css";
      @import url("fonts.css");
      .bg1 { background: url("bg1.png"); }
      .bg2 { background: url(bg2.jpg); }
    `;
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://example.com/styles/reset.css');
    expect(result.links).toContain('https://example.com/styles/fonts.css');
    expect(result.links).toContain('https://example.com/styles/bg1.png');
    expect(result.links).toContain('https://example.com/styles/bg2.jpg');
  });

  it('should resolve relative URLs', () => {
    const css = '@import "../shared/common.css";';
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://example.com/shared/common.css');
  });

  it('should resolve absolute URLs', () => {
    const css = '@import "https://cdn.example.com/lib.css";';
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://cdn.example.com/lib.css');
  });

  it('should skip data: URLs', () => {
    const css = '.class { background: url("data:image/png;base64,abc"); }';
    const result = parseCss(css, baseUrl);
    expect(result.links.length).toBe(0);
  });

  it('should deduplicate URLs', () => {
    const css = `
      @import "common.css";
      @import url("common.css");
      .bg { background: url("common.css"); }
    `;
    const result = parseCss(css, baseUrl);
    const commonLinks = result.links.filter(
      link => link === 'https://example.com/styles/common.css',
    );
    expect(commonLinks.length).toBe(1);
  });

  it('should return baseUrl in result', () => {
    const css = '@import "other.css";';
    const result = parseCss(css, baseUrl);
    expect(result.baseUrl).toBe(baseUrl);
  });

  it('should handle empty CSS', () => {
    const css = '';
    const result = parseCss(css, baseUrl);
    expect(result.links).toEqual([]);
    expect(result.baseUrl).toBe(baseUrl);
  });

  it('should handle CSS with no URLs', () => {
    const css = '.class { color: red; font-size: 14px; }';
    const result = parseCss(css, baseUrl);
    expect(result.links).toEqual([]);
  });

  it('should handle @import with media queries', () => {
    const css = '@import "print.css" print;';
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://example.com/styles/print.css');
  });

  it('should handle url() in various CSS properties', () => {
    const css = `
      .class1 { background-image: url("bg.png"); }
      .class2 { list-style-image: url("bullet.svg"); }
      .class3 { cursor: url("cursor.cur"), pointer; }
      @font-face { src: url("font.woff2"); }
    `;
    const result = parseCss(css, baseUrl);
    expect(result.links).toContain('https://example.com/styles/bg.png');
    expect(result.links).toContain('https://example.com/styles/bullet.svg');
    expect(result.links).toContain('https://example.com/styles/cursor.cur');
    expect(result.links).toContain('https://example.com/styles/font.woff2');
  });
});
