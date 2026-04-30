/**
 * Unit tests for file system writer and path normalization
 * Tests: sanitizeFilename, handleQueryParameters, urlToLocalPath, writeFile
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import {
  sanitizeFilename,
  handleQueryParameters,
  urlToLocalPath,
  writeFile,
  createDirectoryStructure,
} from './writer';

describe('sanitizeFilename', () => {
  it('should replace invalid characters with underscores', () => {
    expect(sanitizeFilename('file<name>.html')).toBe('file_name_.html');
    expect(sanitizeFilename('file:name.html')).toBe('file_name.html');
    expect(sanitizeFilename('file|name.html')).toBe('file_name.html');
  });

  it('should replace slashes with underscores', () => {
    expect(sanitizeFilename('path/to/file.html')).toBe('path_to_file.html');
    expect(sanitizeFilename('path\\to\\file.html')).toBe('path_to_file.html');
  });

  it('should remove leading and trailing dots', () => {
    expect(sanitizeFilename('.hidden')).toBe('hidden');
    expect(sanitizeFilename('file.')).toBe('file');
    expect(sanitizeFilename('..file..')).toBe('file');
  });

  it('should handle reserved Windows filenames', () => {
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('PRN')).toBe('_PRN');
    expect(sanitizeFilename('AUX')).toBe('_AUX');
    expect(sanitizeFilename('COM1')).toBe('_COM1');
  });

  it('should return default filename for empty input', () => {
    expect(sanitizeFilename('')).toBe('index.html');
    expect(sanitizeFilename('   ')).toBe('index.html');
  });

  it('should preserve valid filenames', () => {
    expect(sanitizeFilename('valid-file_name.html')).toBe(
      'valid-file_name.html',
    );
  });
});

describe('handleQueryParameters', () => {
  it('should return pathname for URLs without query parameters', () => {
    const result = handleQueryParameters('https://example.com/path/file.html');
    expect(result).toBe('/path/file.html');
  });

  it('should append hash for URLs with query parameters', () => {
    const result = handleQueryParameters('https://example.com/api?param=value');
    expect(result).toMatch(/^\/api_[a-zA-Z0-9]+$/);
  });

  it('should preserve file extension when adding query hash', () => {
    const result = handleQueryParameters(
      'https://example.com/file.html?id=123',
    );
    expect(result).toMatch(/^\/file_[a-zA-Z0-9]+\.html$/);
  });

  it('should handle URLs with multiple query parameters', () => {
    const result = handleQueryParameters(
      'https://example.com/page.html?a=1&b=2&c=3',
    );
    expect(result).toMatch(/^\/page_[a-zA-Z0-9]+\.html$/);
  });

  it('should return original string for invalid URLs', () => {
    const result = handleQueryParameters('not a url');
    expect(result).toBe('not a url');
  });
});

describe('urlToLocalPath', () => {
  const outputDir = '/output';

  it('should convert simple URL to local path', () => {
    const result = urlToLocalPath('https://example.com/page.html', outputDir);
    expect(result).toBe(path.join(outputDir, 'page.html'));
  });

  it('should preserve directory structure', () => {
    const result = urlToLocalPath(
      'https://example.com/dir/subdir/file.html',
      outputDir,
    );
    expect(result).toBe(path.join(outputDir, 'dir', 'subdir', 'file.html'));
  });

  it('should decode percent-encoded characters', () => {
    const result = urlToLocalPath(
      'https://example.com/my%20file.html',
      outputDir,
    );
    expect(result).toBe(path.join(outputDir, 'my file.html'));
  });

  it('should handle URLs with query parameters', () => {
    const result = urlToLocalPath(
      'https://example.com/api?param=value',
      outputDir,
    );
    expect(result).toMatch(
      new RegExp(
        `^${outputDir.replace(/\\/g, '\\\\')}${path.sep.replace(/\\/g, '\\\\')}api_[a-zA-Z0-9]+$`,
      ),
    );
  });

  it('should use index.html for root URLs', () => {
    const result = urlToLocalPath('https://example.com/', outputDir);
    expect(result).toBe(path.join(outputDir, 'index.html'));
  });

  it('should append index.html to directory URLs', () => {
    const result = urlToLocalPath('https://example.com/dir/', outputDir);
    expect(result).toBe(path.join(outputDir, 'dir', 'index.html'));
  });

  it('should sanitize invalid characters in path', () => {
    const result = urlToLocalPath(
      'https://example.com/path:with:colons/file.html',
      outputDir,
    );
    expect(result).toBe(path.join(outputDir, 'path_with_colons', 'file.html'));
  });

  it('should truncate long filenames', () => {
    const longName = 'a'.repeat(300);
    const result = urlToLocalPath(
      `https://example.com/${longName}.html`,
      outputDir,
    );
    const filename = path.basename(result);
    expect(filename.length).toBeLessThanOrEqual(255);
    expect(filename).toMatch(/\.html$/);
  });

  it('should handle invalid URLs gracefully', () => {
    const result = urlToLocalPath('not a url', outputDir);
    expect(result).toContain(outputDir);
  });
});

describe('createDirectoryStructure', () => {
  const testDir = path.join(__dirname, '../test-output');

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors
    }
  });

  it('should create nested directories', async () => {
    const filePath = path.join(testDir, 'dir1', 'dir2', 'file.html');
    await createDirectoryStructure(filePath);

    const dirExists = await fs
      .access(path.join(testDir, 'dir1', 'dir2'))
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);
  });

  it('should not throw if directory already exists', async () => {
    const filePath = path.join(testDir, 'dir', 'file.html');
    await createDirectoryStructure(filePath);
    await expect(createDirectoryStructure(filePath)).resolves.not.toThrow();
  });
});

describe('writeFile', () => {
  const testDir = path.join(__dirname, '../test-output');

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors
    }
  });

  it('should write file with correct content', async () => {
    const content = Buffer.from('<html>test</html>');
    const result = await writeFile(
      'https://example.com/test.html',
      content,
      testDir,
    );

    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();

    if (result.path) {
      const written = await fs.readFile(result.path);
      expect(written.toString()).toBe(content.toString());
    }
  });

  it('should create directory structure automatically', async () => {
    const content = Buffer.from('test');
    const result = await writeFile(
      'https://example.com/dir1/dir2/file.html',
      content,
      testDir,
    );

    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();

    if (result.path) {
      const fileExists = await fs
        .access(result.path)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    }
  });

  it('should prevent path traversal attacks', async () => {
    const content = Buffer.from('malicious');
    // Try to write outside output directory using ..
    const result = await writeFile(
      'https://example.com/../../../etc/passwd',
      content,
      testDir,
    );

    // Should either fail or write within testDir
    if (result.success && result.path) {
      const resolvedPath = path.resolve(result.path);
      const resolvedTestDir = path.resolve(testDir);
      expect(resolvedPath.startsWith(resolvedTestDir)).toBe(true);
    }
  });

  it('should handle write errors gracefully', async () => {
    const content = Buffer.from('test');
    // Try to write to an invalid location
    const result = await writeFile(
      'https://example.com/test.html',
      content,
      '/invalid/nonexistent/path/that/should/fail',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
