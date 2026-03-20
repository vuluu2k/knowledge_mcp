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
      description: "Algorithmic behavior analysis (no LLM). Returns healthScore (0-100), insights[] with severity/signal/evidence/suggestion, and patterns (chronotype, peakHours, workload). 5 detectors: productivity, procrastination, task-structure, goal-alignment, workload.",
    },
    toolHandler("analyzeBehavior", async () => behavior.analyze())
  );
}
