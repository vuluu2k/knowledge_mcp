import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContextEngine } from "../core/context.js";
import { toolHandler } from "./helpers.js";

export function registerContextTools(
  server: McpServer,
  context: ContextEngine
): void {
  server.registerTool(
    "getTodayContext",
    {
      description: "Today's prioritized snapshot: pending/completed/overdue tasks, top 3 suggested focus tasks, short-term goals, and summary stats.",
    },
    toolHandler("getTodayContext", async () => context.getTodayContext())
  );
}
