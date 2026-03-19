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
      description: `Get today's work context — a prioritized snapshot of what to focus on right now.

Returns:
- pendingTasks: all open tasks (today + backlog)
- completedTasks: already done
- highPriorityTasks: priority === high
- overdueTasks: tasks past their due date
- suggestedFocus: top 3 tasks to focus on (scored by priority + deadline + estimate)
- goals: short-term goals for alignment check
- summary: counts + total estimated time

Use this when the user asks "what should I do?", "what's my focus?", or starts their day. Present the suggestedFocus prominently, flag overdue tasks, and check alignment with goals.`,
    },
    toolHandler("getTodayContext", async () => context.getTodayContext())
  );
}
