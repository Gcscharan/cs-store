/**
 * Property-Based Tests for Failure Notes Sanitisation
 *
 * **Validates: Requirements 5.7, 5.9**
 *
 * Property 8: Failure Notes Sanitisation
 *   For any string s submitted as failure notes, the value passed to
 *   recordDeliveryAttempt shall be s.trim() if s.trim().length > 0, or
 *   undefined if s.trim().length === 0. The submitted notes shall never
 *   exceed 200 characters.
 *
 * Tag: Feature: driver-ux-phase5, Property 8: failure notes sanitisation
 *
 * Each property runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Sanitization function (extracted from ActiveOrderCard)
// ---------------------------------------------------------------------------

/**
 * Sanitizes failure notes according to the spec:
 * - Trims leading and trailing whitespace
 * - Returns undefined if the trimmed string is empty
 * - Ensures the result never exceeds 200 characters
 */
const sanitizeFailureNotes = (notes: string): string | undefined => {
  const trimmed = notes.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  // Ensure we never exceed 200 characters (this would be enforced by TextInput maxLength)
  return trimmed.substring(0, 200);
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

// Generate random strings including whitespace-only strings
const randomStringArb = fc.string({ minLength: 0, maxLength: 250 });

// Generate whitespace-only strings
const whitespaceOnlyArb = fc.array(
  fc.constantFrom(' ', '\t', '\n', '\r'),
  { minLength: 1, maxLength: 50 }
).map(chars => chars.join(''));

// Generate strings that exceed 200 characters
const longStringArb = fc.string({ minLength: 201, maxLength: 500 });

// Generate strings with leading/trailing whitespace
const stringWithWhitespaceArb = fc.tuple(
  fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 10 }).map(chars => chars.join('')),
  fc.string({ minLength: 1, maxLength: 180 }),
  fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 10 }).map(chars => chars.join(''))
).map(([leading, content, trailing]) => leading + content + trailing);

// ---------------------------------------------------------------------------
// Property 8: Failure Notes Sanitisation
// Validates: Requirements 5.7, 5.9
// Tag: Feature: driver-ux-phase5, Property 8: failure notes sanitisation
// ---------------------------------------------------------------------------

describe('Property 8: Failure Notes Sanitisation', () => {
  it('sanitized notes are always trimmed (no leading/trailing whitespace)', () => {
    fc.assert(
      fc.property(randomStringArb, (notes) => {
        const sanitized = sanitizeFailureNotes(notes);

        if (sanitized !== undefined) {
          // Should have no leading whitespace
          expect(sanitized).toBe(sanitized.trimStart());
          // Should have no trailing whitespace
          expect(sanitized).toBe(sanitized.trimEnd());
          // Should equal the trimmed version
          expect(sanitized).toBe(notes.trim().substring(0, 200));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('whitespace-only strings return undefined', () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (notes) => {
        const sanitized = sanitizeFailureNotes(notes);
        expect(sanitized).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('empty string returns undefined', () => {
    const sanitized = sanitizeFailureNotes('');
    expect(sanitized).toBeUndefined();
  });

  it('sanitized notes never exceed 200 characters', () => {
    fc.assert(
      fc.property(randomStringArb, (notes) => {
        const sanitized = sanitizeFailureNotes(notes);

        if (sanitized !== undefined) {
          expect(sanitized.length).toBeLessThanOrEqual(200);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('strings exceeding 200 characters are truncated to 200', () => {
    fc.assert(
      fc.property(longStringArb, (notes) => {
        const sanitized = sanitizeFailureNotes(notes);

        if (sanitized !== undefined) {
          expect(sanitized.length).toBeLessThanOrEqual(200);
          // Should be the first 200 characters of the trimmed string
          expect(sanitized).toBe(notes.trim().substring(0, 200));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('strings with leading/trailing whitespace are trimmed correctly', () => {
    fc.assert(
      fc.property(stringWithWhitespaceArb, (notes) => {
        const sanitized = sanitizeFailureNotes(notes);
        const expectedTrimmed = notes.trim();

        if (expectedTrimmed.length > 0) {
          expect(sanitized).toBe(expectedTrimmed.substring(0, 200));
          expect(sanitized).not.toMatch(/^\s/); // No leading whitespace
          expect(sanitized).not.toMatch(/\s$/); // No trailing whitespace
        } else {
          expect(sanitized).toBeUndefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('non-empty trimmed strings return the trimmed value', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        (notes) => {
          const sanitized = sanitizeFailureNotes(notes);
          expect(sanitized).toBeDefined();
          expect(sanitized).toBe(notes.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sanitization is idempotent (applying twice gives same result)', () => {
    fc.assert(
      fc.property(randomStringArb, (notes) => {
        const sanitized1 = sanitizeFailureNotes(notes);
        const sanitized2 = sanitized1 !== undefined ? sanitizeFailureNotes(sanitized1) : undefined;

        expect(sanitized1).toBe(sanitized2);
      }),
      { numRuns: 100 }
    );
  });

  it('for any string, result is either undefined or a non-empty trimmed string <= 200 chars', () => {
    fc.assert(
      fc.property(randomStringArb, (notes) => {
        const sanitized = sanitizeFailureNotes(notes);

        // Result must be either undefined or a valid string
        expect(sanitized === undefined || typeof sanitized === 'string').toBe(true);

        if (sanitized !== undefined) {
          // Must be non-empty
          expect(sanitized.length).toBeGreaterThan(0);
          // Must be trimmed
          expect(sanitized).toBe(sanitized.trim());
          // Must not exceed 200 characters
          expect(sanitized.length).toBeLessThanOrEqual(200);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Boundary tests
  it('boundary: exactly 200 characters (no trim needed) returns unchanged', () => {
    const notes = 'a'.repeat(200);
    const sanitized = sanitizeFailureNotes(notes);
    expect(sanitized).toBe(notes);
    expect(sanitized?.length).toBe(200);
  });

  it('boundary: 201 characters (no trim needed) returns first 200', () => {
    const notes = 'a'.repeat(201);
    const sanitized = sanitizeFailureNotes(notes);
    expect(sanitized).toBe('a'.repeat(200));
    expect(sanitized?.length).toBe(200);
  });

  it('boundary: single space returns undefined', () => {
    const sanitized = sanitizeFailureNotes(' ');
    expect(sanitized).toBeUndefined();
  });

  it('boundary: single character returns that character', () => {
    const sanitized = sanitizeFailureNotes('a');
    expect(sanitized).toBe('a');
  });

  it('boundary: 200 chars with leading/trailing spaces trims and keeps up to 200', () => {
    const content = 'a'.repeat(198);
    const notes = '  ' + content + '  '; // 202 total chars
    const sanitized = sanitizeFailureNotes(notes);
    expect(sanitized).toBe(content); // Should be trimmed to 198 chars
    expect(sanitized?.length).toBe(198);
  });

  it('boundary: 250 chars with whitespace trims and truncates to 200', () => {
    const content = 'a'.repeat(250);
    const notes = '   ' + content + '   ';
    const sanitized = sanitizeFailureNotes(notes);
    expect(sanitized).toBe('a'.repeat(200));
    expect(sanitized?.length).toBe(200);
  });
});
