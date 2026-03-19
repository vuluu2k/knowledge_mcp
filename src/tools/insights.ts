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
      description: `Analyze the user's productivity and behavior patterns. Returns a comprehensive report including:

- **Task stats**: completion rates, today vs backlog breakdown
- **Task quality issues**: tasks missing priority, due dates, tags, or with vague descriptions
- **Overdue tasks**: tasks past their due date with days overdue
- **Activity patterns**: most active hours and days (from commit history)
- **Goals**: current short-term and long-term goals for alignment analysis
- **All tasks**: full task lists for pattern analysis
- **Inbox health**: unprocessed items count

After receiving this data, you MUST analyze and present:
1. **Insights** — behavioral patterns you observe (productivity peaks, work habits)
2. **Problems** — what is slowing the user down (overdue tasks, vague tasks, goal misalignment, backlog bloat)
3. **Suggestions** — specific, actionable improvements based on the evidence

Be specific and cite evidence from the data. Avoid generic advice.`,
    },
    toolHandler("getInsights", async () => insights.generateReport())
  );
}
