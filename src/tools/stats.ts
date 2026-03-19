import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StatsEngine } from "../core/stats.js";
import { toolHandler } from "./helpers.js";

export function registerStatsTools(
  server: McpServer,
  stats: StatsEngine
): void {
  server.registerTool(
    "getStats",
    {
      description: `Get behavioral statistics and productivity metrics.

Returns:
- completionRate: percentage of tasks completed
- totalTasks / completedTasks / openTasks: counts
- avgTasksPerDay: average task-related actions per active day (from commit history)
- mostActiveHour: peak productivity hour (e.g., "09:00")
- mostActiveDay: most productive day of week (e.g., "Monday")
- staleTasks: tasks likely forgotten (overdue 7+ days, or backlog with no priority/deadline)
- estimateAccuracy: tasks with estimates + total estimated minutes
- tagDistribution: which tags appear most (shows where time goes)

Use when the user asks about their productivity, stats, habits, or performance. Present key metrics clearly, flag stale tasks, and suggest behavioral improvements.`,
    },
    toolHandler("getStats", async () => stats.getStats())
  );
}
