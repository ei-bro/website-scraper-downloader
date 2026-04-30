/**
 * End-to-end integration tests for the Website Scraper Downloader
 * Tests the complete flow with a mock HTTP server
 * Feature: website-scraper-downloader
 * Validates: All requirements
 */

import * as http from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';
import { scrape, ScraperOptions } from './scraper';

describe('Integration Tests - End-to-End Flow', () => {
  let server: http.Server;
  let baseUrl: string;
  const testOutputDir = path.join(__dirname, '..', 'test-integration-output');

  // Mock HTML content with various resource types
  const mockIndexHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <link rel="stylesheet" href="/styles/main.css">
  <script src="/scripts/app.js"></script>
</head>
<body>
  <h1>Welcome</h1>
  <img src="/images/logo.png" alt="Logo">
  <a href="/about.html">About</a>
  <a href="/contact.html">Contact</a>
</body>
</html>
  `.trim();

  const mockAboutHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>About</title>
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
  <h1>About Us</h1>
  <img src="/images/team.jpg" alt="Team">
  <a href="/index.html">Home</a>
</body>
</html>
  `.trim();

  const mockContactHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Contact</title>
</head>
<body>
  <h1>Contact Us</h1>
  <a href="/index.html">Home</a>
</body>
</html>
  `.trim();

  const mockCss = `
body {
  background: url('/images/bg.png');
  font-family: Arial;
}
@import url('/styles/reset.css');
  `.trim();

  const mockResetCss = `
* {
  margin: 0;
  padding: 0;
}
  `.trim();

  const mockJs = `
console.log('App loaded');
  `.trim();

  // Mock binary content (1x1 PNG)
  const mockPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  beforeAll(done => {
    // Create a simple HTTP server for testing
    server = http.createServer((req, res) => {
      const url = req.url || '/';

      // Route requests to appropriate content
      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(mockIndexHtml);
      } else if (url === '/about.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(mockAboutHtml);
      } else if (url === '/contact.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(mockContactHtml);
      } else if (url === '/styles/main.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(mockCss);
      } else if (url === '/styles/reset.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(mockResetCss);
      } else if (url === '/scripts/app.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(mockJs);
      } else if (
        url === '/images/logo.png' ||
        url === '/images/team.jpg' ||
        url === '/images/bg.png'
      ) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(mockPng);
      } else if (url === '/missing.html') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else if (url === '/error.html') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://localhost:${address.port}`;
      }
      done();
    });
  });

  afterAll(done => {
    server.close(done);
  });

  beforeEach(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe('Complete scraping workflow', () => {
    it('should download all resources from a multi-page site', async () => {
      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: null,
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      const result = await scrape(options);

      // Verify statistics
      expect(result.stats.downloaded).toBeGreaterThan(0);
      expect(result.stats.discovered).toBeGreaterThanOrEqual(
        result.stats.downloaded,
      );

      // Verify files were created
      const indexPath = path.join(testOutputDir, 'index.html');
      const aboutPath = path.join(testOutputDir, 'about.html');
      const contactPath = path.join(testOutputDir, 'contact.html');
      const cssPath = path.join(testOutputDir, 'styles', 'main.css');
      const jsPath = path.join(testOutputDir, 'scripts', 'app.js');

      const indexExists = await fs
        .access(indexPath)
        .then(() => true)
        .catch(() => false);
      const aboutExists = await fs
        .access(aboutPath)
        .then(() => true)
        .catch(() => false);
      const contactExists = await fs
        .access(contactPath)
        .then(() => true)
        .catch(() => false);
      const cssExists = await fs
        .access(cssPath)
        .then(() => true)
        .catch(() => false);
      const jsExists = await fs
        .access(jsPath)
        .then(() => true)
        .catch(() => false);

      expect(indexExists).toBe(true);
      expect(aboutExists).toBe(true);
      expect(contactExists).toBe(true);
      expect(cssExists).toBe(true);
      expect(jsExists).toBe(true);
    }, 30000);

    it('should preserve directory structure', async () => {
      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: null,
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      await scrape(options);

      // Verify directory structure
      const stylesDir = path.join(testOutputDir, 'styles');
      const scriptsDir = path.join(testOutputDir, 'scripts');
      const imagesDir = path.join(testOutputDir, 'images');

      const stylesDirExists = await fs
        .access(stylesDir)
        .then(() => true)
        .catch(() => false);
      const scriptsDirExists = await fs
        .access(scriptsDir)
        .then(() => true)
        .catch(() => false);
      const imagesDirExists = await fs
        .access(imagesDir)
        .then(() => true)
        .catch(() => false);

      expect(stylesDirExists).toBe(true);
      expect(scriptsDirExists).toBe(true);
      expect(imagesDirExists).toBe(true);
    }, 30000);

    it('should download CSS resources and parse them for additional URLs', async () => {
      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: null,
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      await scrape(options);

      // Verify CSS files were downloaded
      const mainCssPath = path.join(testOutputDir, 'styles', 'main.css');
      const resetCssPath = path.join(testOutputDir, 'styles', 'reset.css');

      const mainCssExists = await fs
        .access(mainCssPath)
        .then(() => true)
        .catch(() => false);
      const resetCssExists = await fs
        .access(resetCssPath)
        .then(() => true)
        .catch(() => false);

      expect(mainCssExists).toBe(true);
      expect(resetCssExists).toBe(true);

      // Verify images referenced in CSS were downloaded
      const bgImagePath = path.join(testOutputDir, 'images', 'bg.png');
      const bgImageExists = await fs
        .access(bgImagePath)
        .then(() => true)
        .catch(() => false);
      expect(bgImageExists).toBe(true);
    }, 30000);
  });

  describe('Depth limiting', () => {
    it('should respect maxDepth limit', async () => {
      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: 0, // Only download the initial page
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      const result = await scrape(options);

      // With depth 0, should only download the index page
      // Links from index should not be followed
      expect(result.stats.downloaded).toBe(1);

      // Verify only index.html was created
      const indexPath = path.join(testOutputDir, 'index.html');
      const indexExists = await fs
        .access(indexPath)
        .then(() => true)
        .catch(() => false);
      expect(indexExists).toBe(true);

      // Verify linked pages were NOT downloaded
      const aboutPath = path.join(testOutputDir, 'about.html');
      const aboutExists = await fs
        .access(aboutPath)
        .then(() => true)
        .catch(() => false);
      expect(aboutExists).toBe(false);
    }, 30000);

    it('should download resources at depth 1 when maxDepth is 1', async () => {
      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: 1,
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      const result = await scrape(options);

      // Should download index and its direct links
      expect(result.stats.downloaded).toBeGreaterThan(1);

      // Verify index and at least one linked page
      const indexPath = path.join(testOutputDir, 'index.html');
      const indexExists = await fs
        .access(indexPath)
        .then(() => true)
        .catch(() => false);
      expect(indexExists).toBe(true);
    }, 30000);
  });

  describe('Error handling', () => {
    it('should continue downloading after encountering 404 errors', async () => {
      // Create HTML with a broken link
      const htmlWithBrokenLink = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <a href="/missing.html">Broken Link</a>
  <a href="/about.html">Valid Link</a>
</body>
</html>
      `.trim();

      // Temporarily modify server response
      const originalListener = server.listeners('request')[0];
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlWithBrokenLink);
        } else {
          // @ts-ignore
          originalListener(req, res);
        }
      });

      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: null,
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      const result = await scrape(options);

      // Should have at least one failure (missing.html)
      expect(result.stats.failed).toBeGreaterThan(0);

      // Should have successfully downloaded other files
      expect(result.stats.downloaded).toBeGreaterThan(0);

      // Verify failure was recorded
      const hasMissingFailure = result.stats.failures.some(f =>
        f.url.includes('missing.html'),
      );
      expect(hasMissingFailure).toBe(true);

      // Restore original listener
      server.removeAllListeners('request');
      // @ts-ignore
      server.on('request', originalListener);
    }, 30000);

    it('should handle 500 errors gracefully', async () => {
      const htmlWithErrorLink = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <a href="/error.html">Error Link</a>
  <a href="/about.html">Valid Link</a>
</body>
</html>
      `.trim();

      const originalListener = server.listeners('request')[0];
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlWithErrorLink);
        } else {
          // @ts-ignore
          originalListener(req, res);
        }
      });

      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: null,
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      const result = await scrape(options);

      // Should have at least one failure (error.html)
      expect(result.stats.failed).toBeGreaterThan(0);

      // Should have successfully downloaded other files
      expect(result.stats.downloaded).toBeGreaterThan(0);

      // Restore original listener
      server.removeAllListeners('request');
      // @ts-ignore
      server.on('request', originalListener);
    }, 30000);
  });

  describe('Various HTML structures', () => {
    it('should handle HTML with inline styles', async () => {
      const htmlWithInlineStyles = `
<!DOCTYPE html>
<html>
<head><title>Inline Styles</title></head>
<body>
  <div style="background: url('/images/inline-bg.png');">Content</div>
</body>
</html>
      `.trim();

      const originalListener = server.listeners('request')[0];
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlWithInlineStyles);
        } else if (req.url === '/images/inline-bg.png') {
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(mockPng);
        } else {
          // @ts-ignore
          originalListener(req, res);
        }
      });

      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: null,
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      await scrape(options);

      // Verify image from inline style was downloaded
      const inlineBgPath = path.join(testOutputDir, 'images', 'inline-bg.png');
      const inlineBgExists = await fs
        .access(inlineBgPath)
        .then(() => true)
        .catch(() => false);
      expect(inlineBgExists).toBe(true);

      // Restore original listener
      server.removeAllListeners('request');
      // @ts-ignore
      server.on('request', originalListener);
    }, 30000);

    it('should handle HTML with style tags', async () => {
      const htmlWithStyleTag = `
<!DOCTYPE html>
<html>
<head>
  <title>Style Tag</title>
  <style>
    body { background: url('/images/style-tag-bg.png'); }
  </style>
</head>
<body>Content</body>
</html>
      `.trim();

      const originalListener = server.listeners('request')[0];
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlWithStyleTag);
        } else if (req.url === '/images/style-tag-bg.png') {
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(mockPng);
        } else {
          // @ts-ignore
          originalListener(req, res);
        }
      });

      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: null,
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      await scrape(options);

      // Verify image from style tag was downloaded
      const styleTagBgPath = path.join(
        testOutputDir,
        'images',
        'style-tag-bg.png',
      );
      const styleTagBgExists = await fs
        .access(styleTagBgPath)
        .then(() => true)
        .catch(() => false);
      expect(styleTagBgExists).toBe(true);

      // Restore original listener
      server.removeAllListeners('request');
      // @ts-ignore
      server.on('request', originalListener);
    }, 30000);

    it('should handle relative URLs correctly', async () => {
      const htmlWithRelativeUrls = `
<!DOCTYPE html>
<html>
<head><title>Relative URLs</title></head>
<body>
  <a href="page1.html">Page 1</a>
  <a href="./page2.html">Page 2</a>
  <a href="../index.html">Parent</a>
  <img src="./images/rel-img.png">
</body>
</html>
      `.trim();

      const originalListener = server.listeners('request')[0];
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlWithRelativeUrls);
        } else if (req.url === '/page1.html' || req.url === '/page2.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body>Page</body></html>');
        } else if (req.url === '/images/rel-img.png') {
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(mockPng);
        } else {
          // @ts-ignore
          originalListener(req, res);
        }
      });

      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: null,
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      const result = await scrape(options);

      // Should have downloaded multiple files
      expect(result.stats.downloaded).toBeGreaterThan(1);

      // Restore original listener
      server.removeAllListeners('request');
      // @ts-ignore
      server.on('request', originalListener);
    }, 30000);
  });

  describe('Domain filtering', () => {
    it('should not download resources from external domains', async () => {
      const htmlWithExternalLink = `
<!DOCTYPE html>
<html>
<head><title>External Links</title></head>
<body>
  <a href="https://external.com/page.html">External</a>
  <a href="/about.html">Internal</a>
</body>
</html>
      `.trim();

      const originalListener = server.listeners('request')[0];
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlWithExternalLink);
        } else {
          // @ts-ignore
          originalListener(req, res);
        }
      });

      const options: ScraperOptions = {
        targetUrl: baseUrl,
        outputDir: testOutputDir,
        maxDepth: null,
        includeSubdomains: false,
        timeout: 5000,
        maxRetries: 1,
      };

      const result = await scrape(options);

      // Should not have tried to download external.com
      const hasExternalFailure = result.stats.failures.some(f =>
        f.url.includes('external.com'),
      );
      expect(hasExternalFailure).toBe(false);

      // Restore original listener
      server.removeAllListeners('request');
      // @ts-ignore
      server.on('request', originalListener);
    }, 30000);
  });
});
