import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InsightsEngine } from "../core/insights.js";
import { toolHandler } from "./helpers.js";

export function registerInsightTools(
  server: McpServer,
  insights: InsightsEngine
): void {
  server.registerTool(
    "getInsights",
    {
      description: "Raw productivity data dump: task stats, quality issues, overdue items, activity patterns, goals, inbox health. Analyze and present insights, problems, and actionable suggestions from the data.",
    },
    toolHandler("getInsights", async () => insights.generateReport())
  );
}
