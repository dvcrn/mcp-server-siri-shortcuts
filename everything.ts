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

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

/* Input schemas for tools implemented in this server */
const ListShortcutsSchema = z.object({}).strict();

enum ToolName {
  LIST_SHORTCUTS = "list_shortcuts",
}

// Function to execute the list_shortcuts tool
const listShortcuts = async () => {
  return new Promise((resolve, reject) => {
    exec("shortcuts list", (error, stdout, stderr) => {
      if (error) {
        reject(
          new McpError(
            ErrorCode.InternalError,
            `Failed to list shortcuts: ${error.message}`
          )
        );
        return;
      }
      if (stderr) {
        reject(
          new McpError(
            ErrorCode.InternalError,
            `Error listing shortcuts: ${stderr}`
          )
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
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: ToolName.LIST_SHORTCUTS,
        description: "List all available Siri shortcuts",
        inputSchema: zodToJsonSchema(ListShortcutsSchema) as ToolInput,
        run: listShortcuts,
      },
    ];

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    if (name !== ToolName.LIST_SHORTCUTS) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    try {
      // Execute the list_shortcuts tool
      const result = await listShortcuts();
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
            error instanceof Error ? error.message : String(error)
          );
    }
  });

  return { server, cleanup: async () => {} };
};
