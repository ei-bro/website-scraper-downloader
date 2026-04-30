/**
 * Unit tests for ProgressReporter
 */

import { ProgressReporter } from './progress';
import { ProgressStats } from '../types';

describe('ProgressReporter', () => {
  let reporter: ProgressReporter;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    reporter = new ProgressReporter();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with zero stats', () => {
      const stats = reporter.getStats();
      expect(stats.discovered).toBe(0);
      expect(stats.downloaded).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.currentFile).toBe('');
    });
  });

  describe('update', () => {
    it('should update progress statistics', () => {
      const newStats: ProgressStats = {
        discovered: 10,
        downloaded: 5,
        failed: 1,
        currentFile: 'https://example.com/page.html',
      };

      reporter.update(newStats);
      const stats = reporter.getStats();

      expect(stats.discovered).toBe(10);
      expect(stats.downloaded).toBe(5);
      expect(stats.failed).toBe(1);
      expect(stats.currentFile).toBe('https://example.com/page.html');
    });

    it('should replace previous stats completely', () => {
      reporter.update({
        discovered: 10,
        downloaded: 5,
        failed: 1,
        currentFile: 'file1.html',
      });

      reporter.update({
        discovered: 20,
        downloaded: 15,
        failed: 2,
        currentFile: 'file2.html',
      });

      const stats = reporter.getStats();
      expect(stats.discovered).toBe(20);
      expect(stats.downloaded).toBe(15);
      expect(stats.failed).toBe(2);
      expect(stats.currentFile).toBe('file2.html');
    });

    it('should not mutate the input stats object', () => {
      const inputStats: ProgressStats = {
        discovered: 10,
        downloaded: 5,
        failed: 1,
        currentFile: 'test.html',
      };

      reporter.update(inputStats);
      inputStats.discovered = 999;

      const stats = reporter.getStats();
      expect(stats.discovered).toBe(10);
    });
  });

  describe('display', () => {
    it('should display progress to console', () => {
      reporter.update({
        discovered: 10,
        downloaded: 5,
        failed: 1,
        currentFile: 'https://example.com/page.html',
      });

      reporter.display();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Progress: 5/10 downloaded, 1 failed | Current: https://example.com/page.html',
      );
    });

    it('should display zero values correctly', () => {
      reporter.display();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Progress: 0/0 downloaded, 0 failed | Current: ',
      );
    });

    it('should display updated values', () => {
      reporter.update({
        discovered: 100,
        downloaded: 75,
        failed: 5,
        currentFile: 'https://example.com/image.png',
      });

      reporter.display();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Progress: 75/100 downloaded, 5 failed | Current: https://example.com/image.png',
      );
    });
  });

  describe('getStats', () => {
    it('should return a copy of stats', () => {
      reporter.update({
        discovered: 10,
        downloaded: 5,
        failed: 1,
        currentFile: 'test.html',
      });

      const stats1 = reporter.getStats();
      const stats2 = reporter.getStats();

      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2); // Different objects
    });

    it('should not allow external mutation of internal state', () => {
      reporter.update({
        discovered: 10,
        downloaded: 5,
        failed: 1,
        currentFile: 'test.html',
      });

      const stats = reporter.getStats();
      stats.discovered = 999;

      const internalStats = reporter.getStats();
      expect(internalStats.discovered).toBe(10);
    });
  });

  describe('reset', () => {
    it('should reset all stats to zero', () => {
      reporter.update({
        discovered: 100,
        downloaded: 75,
        failed: 5,
        currentFile: 'https://example.com/page.html',
      });

      reporter.reset();

      const stats = reporter.getStats();
      expect(stats.discovered).toBe(0);
      expect(stats.downloaded).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.currentFile).toBe('');
    });

    it('should allow updates after reset', () => {
      reporter.update({
        discovered: 100,
        downloaded: 75,
        failed: 5,
        currentFile: 'file1.html',
      });

      reporter.reset();

      reporter.update({
        discovered: 10,
        downloaded: 5,
        failed: 1,
        currentFile: 'file2.html',
      });

      const stats = reporter.getStats();
      expect(stats.discovered).toBe(10);
      expect(stats.downloaded).toBe(5);
      expect(stats.failed).toBe(1);
      expect(stats.currentFile).toBe('file2.html');
    });
  });

  describe('edge cases', () => {
    it('should handle empty currentFile string', () => {
      reporter.update({
        discovered: 5,
        downloaded: 3,
        failed: 0,
        currentFile: '',
      });

      reporter.display();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Progress: 3/5 downloaded, 0 failed | Current: ',
      );
    });

    it('should handle large numbers', () => {
      reporter.update({
        discovered: 10000,
        downloaded: 9999,
        failed: 1,
        currentFile: 'large-site.html',
      });

      const stats = reporter.getStats();
      expect(stats.discovered).toBe(10000);
      expect(stats.downloaded).toBe(9999);
      expect(stats.failed).toBe(1);
    });

    it('should handle long file URLs', () => {
      const longUrl =
        'https://example.com/very/long/path/to/some/deeply/nested/resource/file.html';
      reporter.update({
        discovered: 10,
        downloaded: 5,
        failed: 0,
        currentFile: longUrl,
      });

      const stats = reporter.getStats();
      expect(stats.currentFile).toBe(longUrl);
    });
  });
});
