import { describe, it, expect } from 'vitest';
import { sanitizeShortcutName, generateUniqueSanitizedName } from './shortcuts.js';

describe('sanitizeShortcutName', () => {
  it('should convert to lowercase', () => {
    expect(sanitizeShortcutName('My Shortcut')).toBe('my_shortcut');
  });

  it('should replace spaces with underscores', () => {
    expect(sanitizeShortcutName('hello world')).toBe('hello_world');
  });

  it('should replace special characters with underscores', () => {
    expect(sanitizeShortcutName('hello@world#test')).toBe('hello_world_test');
  });

  it('should replace multiple underscores with single underscore', () => {
    expect(sanitizeShortcutName('hello___world')).toBe('hello_world');
  });

  it('should remove leading and trailing underscores', () => {
    expect(sanitizeShortcutName('_hello_world_')).toBe('hello_world');
  });

  it('should preserve alphanumeric characters and underscores', () => {
    expect(sanitizeShortcutName('test_123_abc')).toBe('test_123_abc');
  });

  it('should handle empty string', () => {
    expect(sanitizeShortcutName('')).toBe('');
  });

  it('should handle strings with only special characters', () => {
    expect(sanitizeShortcutName('@#$%')).toBe('');
  });

  it('should truncate long names to fit within 64-character limit', () => {
    // "run_shortcut_" is 13 characters, so max sanitized length is 51
    const longName = 'a'.repeat(60); // 60 'a' characters
    const result = sanitizeShortcutName(longName);
    
    // Should be truncated to 51 characters
    expect(result).toBe('a'.repeat(51));
    expect(result.length).toBe(51);
    
    // Verify the full tool name would be exactly 64 characters
    const fullToolName = `run_shortcut_${result}`;
    expect(fullToolName.length).toBe(64);
  });

  it('should handle truncation and remove trailing underscore if present', () => {
    // Create a name that when truncated would end with underscore
    const nameWithUnderscores = 'a'.repeat(50) + '_test';
    const result = sanitizeShortcutName(nameWithUnderscores);
    
    // Should truncate and remove trailing underscore
    expect(result).toBe('a'.repeat(50)); // 50 characters, no trailing underscore
    expect(result.length).toBe(50);
  });

  it('should handle names that are exactly at the limit', () => {
    const exactLimitName = 'a'.repeat(51); // Exactly 51 characters
    const result = sanitizeShortcutName(exactLimitName);
    
    expect(result).toBe(exactLimitName);
    expect(result.length).toBe(51);
  });
});

describe('generateUniqueSanitizedName', () => {
  it('should return the sanitized name when no conflicts exist', () => {
    const existingNames = new Set<string>();
    const result = generateUniqueSanitizedName('My Shortcut', existingNames);
    
    expect(result).toBe('my_shortcut');
  });

  it('should append _1 when the sanitized name conflicts', () => {
    const existingNames = new Set(['my_shortcut']);
    const result = generateUniqueSanitizedName('My Shortcut', existingNames);
    
    expect(result).toBe('my_shortcut_1');
  });

  it('should increment counter for multiple conflicts', () => {
    const existingNames = new Set(['my_shortcut', 'my_shortcut_1', 'my_shortcut_2']);
    const result = generateUniqueSanitizedName('My Shortcut', existingNames);
    
    expect(result).toBe('my_shortcut_3');
  });

  it('should handle long names with conflicts by truncating base name', () => {
    // Create a long name that would need truncation
    const longName = 'a'.repeat(60);
    const baseSanitized = 'a'.repeat(51); // What sanitizeShortcutName would return
    
    const existingNames = new Set([baseSanitized]);
    const result = generateUniqueSanitizedName(longName, existingNames);
    
    // Should truncate base to make room for "_1" suffix
    const expectedBase = 'a'.repeat(49); // 49 + 2 ("_1") = 51 total
    expect(result).toBe(expectedBase + '_1');
    expect(result.length).toBe(51);
    
    // Verify full tool name is within limit
    const fullToolName = `run_shortcut_${result}`;
    expect(fullToolName.length).toBe(64);
  });

  it('should handle multiple conflicts with long names', () => {
    const longName = 'a'.repeat(60);
    const baseSanitized = 'a'.repeat(51);
    
    // Create conflicts up to _9
    const existingNames = new Set([
      baseSanitized,
      'a'.repeat(49) + '_1',
      'a'.repeat(49) + '_2',
      'a'.repeat(49) + '_3',
      'a'.repeat(49) + '_4',
      'a'.repeat(49) + '_5',
      'a'.repeat(49) + '_6',
      'a'.repeat(49) + '_7',
      'a'.repeat(49) + '_8',
      'a'.repeat(49) + '_9'
    ]);
    
    const result = generateUniqueSanitizedName(longName, existingNames);
    
    // Should use _10, which requires truncating base further
    const expectedBase = 'a'.repeat(48); // 48 + 3 ("_10") = 51 total
    expect(result).toBe(expectedBase + '_10');
    expect(result.length).toBe(51);
  });

  it('should handle empty existing names set', () => {
    const existingNames = new Set<string>();
    const result = generateUniqueSanitizedName('test', existingNames);
    
    expect(result).toBe('test');
  });

  it('should work with names that sanitize to empty string', () => {
    const existingNames = new Set<string>();
    const result = generateUniqueSanitizedName('@#$%', existingNames);
    
    // Should return empty string since sanitizeShortcutName returns empty string
    expect(result).toBe('');
  });

  it('should handle conflicts with names that sanitize to empty string', () => {
    const existingNames = new Set(['']);
    const result = generateUniqueSanitizedName('@#$%', existingNames);
    
    // Should append _1 to empty string
    expect(result).toBe('_1');
  });

  it('should ensure final tool name never exceeds 64 characters', () => {
    // Test with various long names and conflict scenarios
    const testCases = [
      'a'.repeat(100),
      'Very Long Shortcut Name That Should Be Truncated',
      'Multiple   Special   Characters   !!!   @@@   ###',
    ];
    
    testCases.forEach((testName) => {
      const existingNames = new Set<string>();
      
      // Generate 10 variations to test conflict resolution
      for (let i = 0; i < 10; i++) {
        const result = generateUniqueSanitizedName(testName, existingNames);
        existingNames.add(result);
        
        const fullToolName = `run_shortcut_${result}`;
        expect(fullToolName.length).toBeLessThanOrEqual(64);
      }
    });
  });
});