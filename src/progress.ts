/**
 * Progress reporter for tracking and displaying download progress
 */

import { ProgressStats } from './types';

/**
 * ProgressReporter class tracks and displays download progress in real-time
 * Implements Requirements 10.1, 10.2, 10.3, 10.4
 */
export class ProgressReporter {
  private stats: ProgressStats;

  constructor() {
    this.stats = {
      discovered: 0,
      downloaded: 0,
      failed: 0,
      currentFile: '',
    };
  }

  /**
   * Update the progress statistics
   * @param stats - New progress statistics
   */
  update(stats: ProgressStats): void {
    this.stats = { ...stats };
  }

  /**
   * Display the current progress to console
   */
  display(): void {
    const { discovered, downloaded, failed, currentFile } = this.stats;
    console.log(
      `Progress: ${downloaded}/${discovered} downloaded, ${failed} failed | Current: ${currentFile}`,
    );
  }

  /**
   * Get the current progress statistics
   * @returns Current progress statistics
   */
  getStats(): ProgressStats {
    return { ...this.stats };
  }

  /**
   * Reset the progress statistics
   */
  reset(): void {
    this.stats = {
      discovered: 0,
      downloaded: 0,
      failed: 0,
      currentFile: '',
    };
  }
}
