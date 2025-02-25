import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
  Tool,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { exec } from "child_process";
import { zodToJsonSchema } from "zod-to-json-schema";
import path from "path";
import fs from "fs";

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

/* Input schemas for tools implemented in this server */
const ListShortcutsSchema = z.object({}).strict();

const OpenShortcutSchema = z
  .object({
    name: z.string().describe("The name of the shortcut to open"),
  })
  .strict();

const RunShortcutSchema = z
  .object({
    name: z.string().describe("The name or identifier of the shortcut to run"),
    input: z
      .string()
      .optional()
      .describe(
        "The input to pass to the shortcut. Can be text, or a filepath",
      ),
  })
  .strict();

enum ToolName {
  LIST_SHORTCUTS = "list_shortcuts",
  OPEN_SHORTCUT = "open_shortcut",
  RUN_SHORTCUT = "run_shortcut",
}

type OpenShortcutInput = z.infer<typeof OpenShortcutSchema>;
type RunShortcutInput = z.infer<typeof RunShortcutSchema>;

type ToolResult = { [key: string]: any };

// Function to execute the list_shortcuts tool
const listShortcuts = async (): Promise<ToolResult> => {
  return new Promise((resolve, reject) => {
    exec("shortcuts list", (error, stdout, stderr) => {
      if (error) {
        reject(
          new McpError(
            ErrorCode.InternalError,
            `Failed to list shortcuts: ${error.message}`,
          ),
        );
        return;
      }
      if (stderr) {
        reject(
          new McpError(
            ErrorCode.InternalError,
            `Error listing shortcuts: ${stderr}`,
          ),
        );
        return;
      }
      const shortcuts = stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => ({ name: line.trim() }));
      resolve({ shortcuts });
    });
  });
};

// Function to execute the open_shortcut tool
const openShortcut = async (params: OpenShortcutInput): Promise<ToolResult> => {
  return new Promise((resolve, reject) => {
    const command = `shortcuts view '${params.name}'`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(
          new McpError(
            ErrorCode.InternalError,
            `Failed to open shortcut: ${error.message}`,
          ),
        );
        return;
      }
      if (stderr) {
        reject(
          new McpError(
            ErrorCode.InternalError,
            `Error opening shortcut: ${stderr}`,
          ),
        );
        return;
      }
      resolve({ success: true, message: `Opened shortcut: ${params.name}` });
    });
  });
};

// Function to execute the run_shortcut tool
const runShortcut = async (params: RunShortcutInput): Promise<ToolResult> => {
  return new Promise((resolve, reject) => {
    let command = `shortcuts run '${params.name}'`;

    if (params.input) {
      // If it's a file path and exists
      const input = params.input;

      if (input.includes("/")) {
        if (!fs.existsSync(input)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Input file does not exist: ${input}`,
          );
        }
        command += ` --input-path '${input}'`;
      } else {
        // Create temp file with content
        const tmpPath = path.join("/tmp", `shortcut-input-${Date.now()}`);
        fs.writeFileSync(tmpPath, input);
        command += ` --input-path '${tmpPath}'`;
      }
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(
          new McpError(
            ErrorCode.InternalError,
            `Failed to run shortcut: ${error.message}`,
          ),
        );
        return;
      }

      // If there's output, return it
      if (stdout.trim()) {
        resolve({ success: true, output: stdout.trim() });
      } else {
        resolve({ success: true, message: `Ran shortcut: ${params.name}` });
      }
    });
  });
};
export const createServer = () => {
  const server = new Server(
    {
      name: "siri-shortcuts-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: ToolName.LIST_SHORTCUTS,
        description: "List all available Siri shortcuts",
        inputSchema: zodToJsonSchema(ListShortcutsSchema) as ToolInput,
        run: listShortcuts,
      },
      {
        name: ToolName.OPEN_SHORTCUT,
        description: "Open a shortcut in the Shortcuts app",
        inputSchema: zodToJsonSchema(OpenShortcutSchema) as ToolInput,
        run: (params: any) => openShortcut(params as OpenShortcutInput),
      },
      {
        name: ToolName.RUN_SHORTCUT,
        description: "Run a shortcut with optional input and output parameters",
        inputSchema: zodToJsonSchema(RunShortcutSchema) as ToolInput,
        run: (params: any) => runShortcut(params as RunShortcutInput),
      },
    ];

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (
      ![
        ToolName.LIST_SHORTCUTS,
        ToolName.OPEN_SHORTCUT,
        ToolName.RUN_SHORTCUT,
      ].includes(name as ToolName)
    ) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    try {
      let result: ToolResult | undefined;

      // Execute the appropriate tool based on the name
      switch (name as ToolName) {
        case ToolName.LIST_SHORTCUTS:
          result = await listShortcuts();
          break;
        case ToolName.OPEN_SHORTCUT:
          result = await openShortcut(args as OpenShortcutInput);
          break;
        case ToolName.RUN_SHORTCUT:
          result = await runShortcut(args as RunShortcutInput);
          break;
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      // Re-throw any errors that occur during execution
      throw error instanceof McpError
        ? error
        : new McpError(
            ErrorCode.InternalError,
            error instanceof Error ? error.message : String(error),
          );
    }
  });

  return { server, cleanup: async () => {} };
};
