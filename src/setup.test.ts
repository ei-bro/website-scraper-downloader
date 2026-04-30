/**
 * Verification test for property-based testing setup with fast-check
 */

import * as fc from 'fast-check';
import { ResourceType } from './types';

describe('Property-Based Testing Setup', () => {
  it('should verify fast-check is working with a simple property', () => {
    // Property: For any string, converting to ResourceType enum values should be consistent
    fc.assert(
      fc.property(
        fc.constantFrom(
          ResourceType.HTML,
          ResourceType.CSS,
          ResourceType.JavaScript,
          ResourceType.Image,
          ResourceType.Font,
          ResourceType.Media,
          ResourceType.Other,
        ),
        (resourceType) => {
          // Property: ResourceType values should be non-empty strings
          expect(typeof resourceType).toBe('string');
          expect(resourceType.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should verify fast-check can generate URLs', () => {
    // Property: Generated URLs should be strings
    fc.assert(
      fc.property(fc.webUrl(), (url) => {
        expect(typeof url).toBe('string');
        expect(url.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('should verify fast-check can generate integers', () => {
    // Property: For any non-negative integer, it should be >= 0
    fc.assert(
      fc.property(fc.nat(), (n) => {
        expect(n).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });
});
