import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { allTools } from "./tools";
import type { ApiKeyContext } from "@/lib/auth/api-key";
import { db } from "@/lib/db/client";
import { mcpCallLog } from "@/lib/db/schema";
import { z } from "zod/v4";

export function createMcpServer(ctx: ApiKeyContext): McpServer {
  const server = new McpServer({
    name: "starcms",
    version: "0.1.0",
  });

  for (const tool of allTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema instanceof z.ZodObject
        ? (tool.inputSchema as z.ZodObject).shape
        : {},
      async (input: Record<string, unknown>) => {
        const start = Date.now();
        let outcome: "ok" | "error" = "ok";
        try {
          const result = await tool.handler(input, ctx);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          outcome = "error";
          throw err;
        } finally {
          const durationMs = Date.now() - start;
          const inputSummary = JSON.stringify(input).slice(0, 200);
          db.insert(mcpCallLog)
            .values({
              apiKeyId: ctx.keyId,
              tool: tool.name,
              inputSummary,
              outcome,
              durationMs,
            })
            .catch(() => undefined);
        }
      }
    );
  }

  return server;
}
