/**
 * File system writer and path normalization utilities
 * Handles converting URLs to local paths and writing files to disk
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { WriteResult } from '../types';

/**
 * Maximum filename length for most file systems
 * Using 255 as a safe limit for most modern file systems
 */
const MAX_FILENAME_LENGTH = 255;

/**
 * Characters that are invalid in filenames across common file systems
 * Includes: < > : " / \ | ? * and control characters
 */
// eslint-disable-next-line no-control-regex -- explicit control-char strip for cross-platform filenames
const INVALID_FILENAME_CHARS = /[<>:"|?*\x00-\x1F]/g;

/**
 * Sanitizes a filename by replacing invalid characters with safe alternatives
 * Handles special characters, control characters, and filesystem-specific restrictions
 *
 * @param filename - The filename to sanitize
 * @returns A sanitized filename safe for the local filesystem
 *
 * Requirements: 13.1, 13.2
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || filename.trim() === '') {
    return 'index.html';
  }

  // Replace invalid characters with underscores
  let sanitized = filename.replace(INVALID_FILENAME_CHARS, '_');

  // Replace forward and backward slashes (path separators)
  sanitized = sanitized.replace(/[/\\]/g, '_');

  // Remove leading/trailing dots and spaces (problematic on Windows)
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

  // If filename is now empty after sanitization, use default
  if (sanitized === '') {
    return 'index.html';
  }

  // Handle reserved Windows filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedNames.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  return sanitized;
}

/**
 * Handles query parameters in URLs by converting them to a filename-safe format
 * Query parameters are hashed to create a unique but filesystem-safe identifier
 *
 * @param url - The URL with potential query parameters
 * @returns A filename-safe representation of the URL
 *
 * Requirements: 13.1
 */
export function handleQueryParameters(url: string): string {
  try {
    const parsed = new URL(url);

    // If no query parameters, return pathname as-is
    if (!parsed.search || parsed.search === '?') {
      return parsed.pathname;
    }

    // Create a simple hash of query parameters for uniqueness
    const queryHash = Buffer.from(parsed.search)
      .toString('base64')
      .replace(/[+/=]/g, '')
      .substring(0, 8);

    // Get the pathname and add query hash before extension
    const pathname = parsed.pathname;
    const ext = path.extname(pathname);
    const base = ext ? pathname.slice(0, -ext.length) : pathname;

    return `${base}_${queryHash}${ext}`;
  } catch (_error) {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Converts a URL to a local file path, preserving the server directory structure
 * Handles URL decoding, special characters, and filename length limits
 *
 * @param url - The absolute URL to convert
 * @param outputDir - The base output directory
 * @returns The local file path where the resource should be saved
 *
 * Requirements: 7.2, 13.1, 13.2, 13.3, 13.4
 */
export function urlToLocalPath(url: string, outputDir: string): string {
  try {
    // Handle query parameters
    let pathname = handleQueryParameters(url);

    // Decode percent-encoded characters (Requirement 13.4)
    pathname = decodeURIComponent(pathname);

    // Remove leading slash
    if (pathname.startsWith('/')) {
      pathname = pathname.substring(1);
    }

    // If pathname is empty, use index.html
    if (pathname === '' || pathname === '/') {
      pathname = 'index.html';
    }

    // If pathname ends with /, append index.html
    if (pathname.endsWith('/')) {
      pathname = `${pathname}index.html`;
    }

    // Split path into directory parts and filename
    const parts = pathname.split('/');
    const filename = parts.pop() || 'index.html';
    const directories = parts;

    // Sanitize each directory part
    const sanitizedDirs = directories.map((dir) => sanitizeFilename(dir));

    // Sanitize filename
    let sanitizedFilename = sanitizeFilename(filename);

    // Handle filename length limits (Requirement 13.3)
    if (sanitizedFilename.length > MAX_FILENAME_LENGTH) {
      const ext = path.extname(sanitizedFilename);
      const base = ext ? sanitizedFilename.slice(0, -ext.length) : sanitizedFilename;

      // Create a hash of the original filename for uniqueness
      const hash = Buffer.from(filename).toString('base64').replace(/[+/=]/g, '').substring(0, 8);

      // Truncate base and add hash
      const maxBaseLength = MAX_FILENAME_LENGTH - ext.length - hash.length - 1;
      const truncatedBase = base.substring(0, maxBaseLength);
      sanitizedFilename = `${truncatedBase}_${hash}${ext}`;
    }

    // Construct full path
    const relativePath = [...sanitizedDirs, sanitizedFilename].join(path.sep);
    return path.join(outputDir, relativePath);
  } catch (_error) {
    // If URL parsing fails, create a safe fallback path
    const safeName = sanitizeFilename(url.replace(/[:/]/g, '_'));
    return path.join(outputDir, safeName);
  }
}

/**
 * Creates the directory structure for a given file path
 * Ensures all parent directories exist before writing a file
 *
 * @param filePath - The full file path
 * @returns Promise that resolves when directories are created
 *
 * Requirements: 7.1, 7.3
 */
export async function createDirectoryStructure(filePath: string): Promise<void> {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
}

/**
 * Writes a file to disk with the appropriate directory structure
 * Ensures the file is written within the output directory
 *
 * @param url - The URL of the resource
 * @param content - The file content as a Buffer
 * @param outputDir - The base output directory
 * @returns WriteResult indicating success or failure
 *
 * Requirements: 2.2, 4.2, 5.2, 6.5, 7.1, 7.3, 12.4
 */
export async function writeFile(
  url: string,
  content: Buffer,
  outputDir: string,
): Promise<WriteResult> {
  try {
    // Convert URL to local path
    const localPath = urlToLocalPath(url, outputDir);

    // Ensure the path is within the output directory (Requirement 12.4)
    const resolvedOutputDir = path.resolve(outputDir);
    const resolvedLocalPath = path.resolve(localPath);

    if (!resolvedLocalPath.startsWith(resolvedOutputDir)) {
      return {
        success: false,
        error: 'Path traversal detected: file path is outside output directory',
      };
    }

    // Create directory structure
    await createDirectoryStructure(localPath);

    // Write file
    await fs.writeFile(localPath, content);

    return {
      success: true,
      path: localPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
