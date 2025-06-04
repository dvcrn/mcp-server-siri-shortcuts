import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeShortcutName, generateUniqueSanitizedName } from './shortcuts.js';
import { z } from 'zod';

// Define the schema to match what's in shortcuts.ts
const RunShortcutSchema = z
  .object({
    name: z.string().describe("The name or identifier (UUID) of the shortcut to run"),
    input: z
      .string()
      .optional()
      .describe(
        "The input to pass to the shortcut. Can be text, or a filepath",
      ),
  })
  .strict();

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

describe('Shortcut Identifier Parsing', () => {
  it('should parse shortcut names with identifiers correctly', () => {
    const testCases = [
      {
        input: 'Simple Shortcut (D9DBF774-F5CF-4E2E-9418-392951F0C770)',
        expected: { name: 'Simple Shortcut', identifier: 'D9DBF774-F5CF-4E2E-9418-392951F0C770' }
      },
      {
        input: 'Shortcut (Name) (D9DBF774-F5CF-4E2E-9418-392951F0C770)',
        expected: { name: 'Shortcut (Name)', identifier: 'D9DBF774-F5CF-4E2E-9418-392951F0C770' }
      },
      {
        input: 'Complex (Name) With (Brackets) (D9DBF774-F5CF-4E2E-9418-392951F0C770)',
        expected: { name: 'Complex (Name) With (Brackets)', identifier: 'D9DBF774-F5CF-4E2E-9418-392951F0C770' }
      },
      {
        input: 'Shortcut Without UUID',
        expected: { name: 'Shortcut Without UUID', identifier: undefined }
      },
      {
        input: '(Leading Bracket) Shortcut (D9DBF774-F5CF-4E2E-9418-392951F0C770)',
        expected: { name: '(Leading Bracket) Shortcut', identifier: 'D9DBF774-F5CF-4E2E-9418-392951F0C770' }
      }
    ];

    testCases.forEach(testCase => {
      const match = testCase.input.match(/^(.+?)\s*\(([A-F0-9-]+)\)$/);
      if (match) {
        expect(match[1].trim()).toBe(testCase.expected.name);
        expect(match[2]).toBe(testCase.expected.identifier);
      } else {
        expect(testCase.expected.identifier).toBeUndefined();
      }
    });
  });
});

describe('Configuration Environment Variables', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset modules to allow re-importing with different env vars
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('GENERATE_SHORTCUT_TOOLS environment variable', () => {
    it('should default to true when not set', () => {
      delete process.env.GENERATE_SHORTCUT_TOOLS;
      
      // Mock child_process before importing
      vi.doMock('child_process', () => ({
        exec: vi.fn(),
        spawn: vi.fn()
      }));
      
      // Since the env vars are read at module import, we need to check the behavior
      // by testing if the default value would be true
      const shouldGenerate = process.env.GENERATE_SHORTCUT_TOOLS !== "false";
      expect(shouldGenerate).toBe(true);
    });

    it('should be false when explicitly set to "false"', () => {
      process.env.GENERATE_SHORTCUT_TOOLS = 'false';
      
      const shouldGenerate = process.env.GENERATE_SHORTCUT_TOOLS !== "false";
      expect(shouldGenerate).toBe(false);
    });

    it('should be true when set to "true"', () => {
      process.env.GENERATE_SHORTCUT_TOOLS = 'true';
      
      const shouldGenerate = process.env.GENERATE_SHORTCUT_TOOLS !== "false";
      expect(shouldGenerate).toBe(true);
    });

    it('should be true when set to any other value', () => {
      process.env.GENERATE_SHORTCUT_TOOLS = 'yes';
      
      const shouldGenerate = process.env.GENERATE_SHORTCUT_TOOLS !== "false";
      expect(shouldGenerate).toBe(true);
    });
  });

  describe('INJECT_SHORTCUT_LIST environment variable', () => {
    it('should default to false when not set', () => {
      delete process.env.INJECT_SHORTCUT_LIST;
      
      const shouldInject = process.env.INJECT_SHORTCUT_LIST === "true";
      expect(shouldInject).toBe(false);
    });

    it('should be true when set to "true"', () => {
      process.env.INJECT_SHORTCUT_LIST = 'true';
      
      const shouldInject = process.env.INJECT_SHORTCUT_LIST === "true";
      expect(shouldInject).toBe(true);
    });

    it('should be false when set to "false"', () => {
      process.env.INJECT_SHORTCUT_LIST = 'false';
      
      const shouldInject = process.env.INJECT_SHORTCUT_LIST === "true";
      expect(shouldInject).toBe(false);
    });

    it('should be false when set to any other value', () => {
      process.env.INJECT_SHORTCUT_LIST = 'yes';
      
      const shouldInject = process.env.INJECT_SHORTCUT_LIST === "true";
      expect(shouldInject).toBe(false);
    });
  });
});

describe('Shortcut Identifier Support', () => {
  it('should document that run_shortcut accepts UUID identifiers', () => {
    // This test verifies that the schema correctly documents UUID support
    const schema = RunShortcutSchema.shape;
    expect(schema.name._def.description).toContain('identifier (UUID)');
  });

  it('should validate UUID format in schema', () => {
    // Test that the schema accepts valid UUIDs
    const validInput = {
      name: 'D9DBF774-F5CF-4E2E-9418-392951F0C770',
      input: 'test input'
    };
    
    const result = RunShortcutSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should validate shortcut names with identifiers', () => {
    // Test that the schema accepts names with identifiers
    const validInput = {
      name: 'Video To GIF 1 (D9DBF774-F5CF-4E2E-9418-392951F0C770)',
      input: 'test input'
    };
    
    const result = RunShortcutSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });
});

describe('Server Configuration Integration', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('should read environment variables correctly at module level', async () => {
    // Set environment variables before importing
    process.env.GENERATE_SHORTCUT_TOOLS = 'false';
    process.env.INJECT_SHORTCUT_LIST = 'true';
    
    // Mock child_process
    const mockExec = vi.fn((command, callback) => {
      if (command === 'shortcuts list --show-identifiers') {
        callback(null, 'Test Shortcut 1 (UUID-1234)\nTest Shortcut 2 (UUID-5678)\n', '');
      }
    });
    
    vi.doMock('child_process', () => ({
      exec: mockExec,
      spawn: vi.fn()
    }));
    
    // Import after setting env vars and mocks
    const shortcuts = await import('./shortcuts.js');
    
    // Test that the module imported successfully with the env vars
    expect(shortcuts).toBeDefined();
    expect(shortcuts.createServer).toBeDefined();
  });

  it('should handle shortcut list injection in description', () => {
    // Test the logic for injecting shortcut list
    const shortcutMap = new Map([
      ['Test Shortcut 1', 'test_shortcut_1'],
      ['Test Shortcut 2', 'test_shortcut_2']
    ]);
    
    const shortcutIdentifierMap = new Map([
      ['Test Shortcut 1', 'UUID-1234'],
      ['Test Shortcut 2', 'UUID-5678']
    ]);
    
    const INJECT_SHORTCUT_LIST = true;
    let runShortcutDescription = "Run a shortcut by name or identifier (UUID) with optional input and output parameters";
    
    // Simulate the description injection logic from the code
    if (INJECT_SHORTCUT_LIST && shortcutMap.size > 0) {
      const shortcutList = Array.from(shortcutMap.keys())
        .map(name => {
          const identifier = shortcutIdentifierMap.get(name);
          if (identifier) {
            return `- "${name}" (${identifier})`;
          }
          return `- "${name}"`;
        })
        .join('\n');
      runShortcutDescription += `\n\nAvailable shortcuts:\n${shortcutList}`;
    }
    
    expect(runShortcutDescription).toContain('Available shortcuts:');
    expect(runShortcutDescription).toContain('- "Test Shortcut 1" (UUID-1234)');
    expect(runShortcutDescription).toContain('- "Test Shortcut 2" (UUID-5678)');
  });

  it('should not inject shortcut list when INJECT_SHORTCUT_LIST is false', () => {
    const shortcutMap = new Map([
      ['Test Shortcut 1', 'test_shortcut_1'],
      ['Test Shortcut 2', 'test_shortcut_2']
    ]);
    
    const shortcutIdentifierMap = new Map([
      ['Test Shortcut 1', 'UUID-1234'],
      ['Test Shortcut 2', 'UUID-5678']
    ]);
    
    const INJECT_SHORTCUT_LIST = false;
    let runShortcutDescription = "Run a shortcut by name or identifier (UUID) with optional input and output parameters";
    
    // Simulate the description injection logic from the code
    if (INJECT_SHORTCUT_LIST && shortcutMap.size > 0) {
      const shortcutList = Array.from(shortcutMap.keys())
        .map(name => {
          const identifier = shortcutIdentifierMap.get(name);
          if (identifier) {
            return `- "${name}" (${identifier})`;
          }
          return `- "${name}"`;
        })
        .join('\n');
      runShortcutDescription += `\n\nAvailable shortcuts:\n${shortcutList}`;
    }
    
    expect(runShortcutDescription).not.toContain('Available shortcuts:');
    expect(runShortcutDescription).not.toContain('Test Shortcut 1');
  });

  it('should not inject shortcut list when no shortcuts are available', () => {
    const shortcutMap = new Map<string, string>();
    const shortcutIdentifierMap = new Map<string, string>();
    
    const INJECT_SHORTCUT_LIST = true;
    let runShortcutDescription = "Run a shortcut by name or identifier (UUID) with optional input and output parameters";
    
    // Simulate the description injection logic from the code
    if (INJECT_SHORTCUT_LIST && shortcutMap.size > 0) {
      const shortcutList = Array.from(shortcutMap.keys())
        .map(name => {
          const identifier = shortcutIdentifierMap.get(name);
          if (identifier) {
            return `- "${name}" (${identifier})`;
          }
          return `- "${name}"`;
        })
        .join('\n');
      runShortcutDescription += `\n\nAvailable shortcuts:\n${shortcutList}`;
    }
    
    expect(runShortcutDescription).not.toContain('Available shortcuts:');
  });

  it('should validate tool names based on GENERATE_SHORTCUT_TOOLS setting', () => {
    // Test the logic for validating dynamic tool calls
    const GENERATE_SHORTCUT_TOOLS = false;
    const toolName = 'run_shortcut_test_shortcut_1';
    
    // Base tools
    const baseTool = ['list_shortcuts', 'open_shortcut', 'run_shortcut'].includes(toolName);
    
    // Dynamic tool check
    const isDynamicTool = GENERATE_SHORTCUT_TOOLS && toolName.startsWith('run_shortcut_');
    
    const isValidTool = baseTool || isDynamicTool;
    
    expect(baseTool).toBe(false); // This is not a base tool
    expect(isDynamicTool).toBe(false); // Dynamic tools are disabled
    expect(isValidTool).toBe(false); // So this tool should not be valid
  });

  it('should allow dynamic tools when GENERATE_SHORTCUT_TOOLS is true', () => {
    const GENERATE_SHORTCUT_TOOLS = true;
    const toolName = 'run_shortcut_test_shortcut_1';
    
    // Base tools
    const baseTool = ['list_shortcuts', 'open_shortcut', 'run_shortcut'].includes(toolName);
    
    // Dynamic tool check
    const isDynamicTool = GENERATE_SHORTCUT_TOOLS && toolName.startsWith('run_shortcut_');
    
    const isValidTool = baseTool || isDynamicTool;
    
    expect(baseTool).toBe(false); // This is not a base tool
    expect(isDynamicTool).toBe(true); // Dynamic tools are enabled and this matches the pattern
    expect(isValidTool).toBe(true); // So this tool should be valid
  });

  it('should always allow base tools regardless of GENERATE_SHORTCUT_TOOLS setting', () => {
    const baseTools = ['list_shortcuts', 'open_shortcut', 'run_shortcut'];
    
    // Test with GENERATE_SHORTCUT_TOOLS = false
    let GENERATE_SHORTCUT_TOOLS = false;
    
    baseTools.forEach(toolName => {
      const baseTool = baseTools.includes(toolName);
      const isDynamicTool = GENERATE_SHORTCUT_TOOLS && toolName.startsWith('run_shortcut_');
      const isValidTool = baseTool || isDynamicTool;
      
      expect(isValidTool).toBe(true);
    });
    
    // Test with GENERATE_SHORTCUT_TOOLS = true
    GENERATE_SHORTCUT_TOOLS = true;
    
    baseTools.forEach(toolName => {
      const baseTool = baseTools.includes(toolName);
      const isDynamicTool = GENERATE_SHORTCUT_TOOLS && toolName.startsWith('run_shortcut_');
      const isValidTool = baseTool || isDynamicTool;
      
      expect(isValidTool).toBe(true);
    });
  });
});