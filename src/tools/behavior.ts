import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BehaviorEngine } from "../core/behavior.js";
import { toolHandler } from "./helpers.js";

export function registerBehaviorTools(
  server: McpServer,
  behavior: BehaviorEngine
): void {
  server.registerTool(
    "analyzeBehavior",
    {
      description: `Run algorithmic behavior analysis — detects patterns and outputs structured insights with NO LLM involved.

Returns a BehaviorReport with:

**healthScore** (0-100): Overall productivity health. Deductions for overdue tasks, priority inversion, missing metadata, workload issues. Bonuses for well-structured tasks.

**insights[]**: Each insight has:
- id: unique identifier
- category: productivity | procrastination | task-structure | goal-alignment | workload
- severity: high | medium | low
- signal: what was detected
- evidence: specific data backing it
- suggestion: actionable fix

**patterns.productivity**: Detected work patterns:
- chronotype: early-bird / night-owl / balanced (from commit timestamps)
- peakHours: top 3 most active hours
- peakDays: most productive days of week
- consistencyScore: % of last 14 days with activity
- trendDirection: improving / declining / stable

**patterns.workload**: Current workload state:
- todayLoadMinutes: total estimated work for today
- backlogRatio: % of open tasks sitting in backlog
- topTags: where time goes (top 5 tags)
- estimateCoverage: % of tasks with time estimates

Detectors run:
1. Productivity — chronotype, weekend work, activity trend, inactivity
2. Procrastination — priority inversion, overdue accumulation, estimate avoidance
3. Task structure — vague tasks, oversized tasks (>4h), missing priority/tags
4. Goal alignment — keyword overlap between tasks and goals
5. Workload — overcommitment (>8h/day), inbox overflow, backlog bloat

Present the healthScore prominently, then insights grouped by severity (high first). Use evidence to be specific, not generic.`,
    },
    toolHandler("analyzeBehavior", async () => behavior.analyze())
  );
}
