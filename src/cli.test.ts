/**
 * Unit tests for CLI interface
 * Feature: website-scraper-downloader
 */

import { parseArguments } from './cli';

describe('CLI Interface', () => {
  describe('parseArguments', () => {
    it('should parse URL from first positional argument', () => {
      const args = ['https://example.com'];
      const result = parseArguments(args);

      expect(result.url).toBe('https://example.com');
      expect(result.output).toBeUndefined();
      expect(result.maxDepth).toBeUndefined();
      expect(result.includeSubdomains).toBe(false);
    });

    it('should parse URL with --url flag', () => {
      const args = ['--url', 'https://example.com'];
      const result = parseArguments(args);

      expect(result.url).toBe('https://example.com');
    });

    it('should parse URL with -u flag', () => {
      const args = ['-u', 'https://example.com'];
      const result = parseArguments(args);

      expect(result.url).toBe('https://example.com');
    });

    it('should parse output directory with --output flag', () => {
      const args = ['https://example.com', '--output', './downloads'];
      const result = parseArguments(args);

      expect(result.url).toBe('https://example.com');
      expect(result.output).toBe('./downloads');
    });

    it('should parse output directory with -o flag', () => {
      const args = ['https://example.com', '-o', './downloads'];
      const result = parseArguments(args);

      expect(result.output).toBe('./downloads');
    });

    it('should parse max depth with --max-depth flag', () => {
      const args = ['https://example.com', '--max-depth', '3'];
      const result = parseArguments(args);

      expect(result.maxDepth).toBe(3);
    });

    it('should parse max depth with -d flag', () => {
      const args = ['https://example.com', '-d', '5'];
      const result = parseArguments(args);

      expect(result.maxDepth).toBe(5);
    });

    it('should parse include subdomains flag', () => {
      const args = ['https://example.com', '--include-subdomains'];
      const result = parseArguments(args);

      expect(result.includeSubdomains).toBe(true);
    });

    it('should parse include subdomains with -s flag', () => {
      const args = ['https://example.com', '-s'];
      const result = parseArguments(args);

      expect(result.includeSubdomains).toBe(true);
    });

    it('should parse all options together', () => {
      const args = [
        'https://example.com',
        '--output',
        './my-downloads',
        '--max-depth',
        '2',
        '--include-subdomains',
      ];
      const result = parseArguments(args);

      expect(result.url).toBe('https://example.com');
      expect(result.output).toBe('./my-downloads');
      expect(result.maxDepth).toBe(2);
      expect(result.includeSubdomains).toBe(true);
    });

    it('should throw error if URL is missing', () => {
      const args = ['--output', './downloads'];

      expect(() => parseArguments(args)).toThrow('URL is required');
    });

    it('should throw error if --url flag has no value', () => {
      const args = ['--url'];

      expect(() => parseArguments(args)).toThrow('--url requires a value');
    });

    it('should throw error if --output flag has no value', () => {
      const args = ['https://example.com', '--output'];

      expect(() => parseArguments(args)).toThrow('--output requires a value');
    });

    it('should throw error if --max-depth flag has no value', () => {
      const args = ['https://example.com', '--max-depth'];

      expect(() => parseArguments(args)).toThrow(
        '--max-depth requires a value',
      );
    });

    it('should throw error if max depth is not a number', () => {
      const args = ['https://example.com', '--max-depth', 'abc'];

      expect(() => parseArguments(args)).toThrow(
        '--max-depth must be a non-negative integer',
      );
    });

    it('should throw error if max depth is negative', () => {
      const args = ['https://example.com', '--max-depth', '-1'];

      expect(() => parseArguments(args)).toThrow(
        '--max-depth must be a non-negative integer',
      );
    });

    it('should throw error for unknown arguments', () => {
      const args = ['https://example.com', '--unknown-flag'];

      expect(() => parseArguments(args)).toThrow('Unknown argument');
    });

    it('should handle mixed flag styles', () => {
      const args = [
        '-u',
        'https://example.com',
        '-o',
        './output',
        '-d',
        '1',
        '-s',
      ];
      const result = parseArguments(args);

      expect(result.url).toBe('https://example.com');
      expect(result.output).toBe('./output');
      expect(result.maxDepth).toBe(1);
      expect(result.includeSubdomains).toBe(true);
    });

    it('should handle zero as max depth', () => {
      const args = ['https://example.com', '--max-depth', '0'];
      const result = parseArguments(args);

      expect(result.maxDepth).toBe(0);
    });

    it('should default includeSubdomains to false', () => {
      const args = ['https://example.com'];
      const result = parseArguments(args);

      expect(result.includeSubdomains).toBe(false);
    });
  });
});
