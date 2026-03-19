import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AutoActionEngine } from "../core/autoAction.js";
import { toolHandler } from "./helpers.js";

export function registerAutoActionTools(
  server: McpServer,
  engine: AutoActionEngine
): void {
  // ─── Master tool: run all auto-actions ───────────────────

  server.registerTool(
    "runAutoActions",
    {
      description: `Run ALL auto-optimization actions on your task system. This is the self-optimizing engine.

Actions executed (in order):
1. **autoReschedule** — moves overdue backlog tasks to today
2. **autoSplitTask** — breaks down tasks >4h or overdue >7 days into plan/execute/verify
3. **autoPrioritize** — promotes top backlog tasks to today when backlog >10 and today <5
4. **autoCleanup** — removes duplicates and stale abandoned tasks
5. **autoInjectTask** — creates tasks for goals with no matching work

IMPORTANT: Always run with dryRun=true first to preview changes. Then dryRun=false to apply. All changes are batched into ONE atomic git commit.

Each action includes: type, reason (why triggered), impact (what changed), details (specific changes).`,
      inputSchema: {
        dryRun: z
          .boolean()
          .describe(
            "true = preview changes without writing. false = apply changes and commit to GitHub"
          ),
      },
    },
    toolHandler("runAutoActions", async ({ dryRun }) =>
      engine.run({ dryRun })
    )
  );

  // ─── Individual action tools ─────────────────────────────

  server.registerTool(
    "autoReschedule",
    {
      description:
        "Move overdue backlog tasks to today. Triggered when backlog tasks have due dates in the past.",
      inputSchema: {
        dryRun: z
          .boolean()
          .optional()
          .default(true)
          .describe("Preview only (default true)"),
      },
    },
    toolHandler("autoReschedule", async ({ dryRun }) =>
      engine.run({ dryRun, only: "autoReschedule" })
    )
  );

  server.registerTool(
    "autoSplitTask",
    {
      description:
        "Split oversized or stuck tasks into plan → execute → verify phases. Triggers on estimate >4h or overdue >7 days. Optionally target a specific task by ID.",
      inputSchema: {
        dryRun: z
          .boolean()
          .optional()
          .default(true)
          .describe("Preview only (default true)"),
        taskId: z
          .string()
          .optional()
          .describe("Specific task ID to split (from getTasks). If omitted, auto-detects candidates."),
      },
    },
    toolHandler("autoSplitTask", async ({ dryRun, taskId }) =>
      engine.run({ dryRun, only: "autoSplitTask", taskId })
    )
  );

  server.registerTool(
    "autoPrioritize",
    {
      description:
        "Promote top backlog tasks to today. Triggered when backlog >10 open items and today <5. Selects by priority + deadline + estimate score.",
      inputSchema: {
        dryRun: z
          .boolean()
          .optional()
          .default(true)
          .describe("Preview only (default true)"),
      },
    },
    toolHandler("autoPrioritize", async ({ dryRun }) =>
      engine.run({ dryRun, only: "autoPrioritize" })
    )
  );

  server.registerTool(
    "autoCleanup",
    {
      description:
        "Remove duplicate tasks (same text in today + backlog) and stale abandoned tasks (backlog items with no priority, no deadline, no tags, vague description).",
      inputSchema: {
        dryRun: z
          .boolean()
          .optional()
          .default(true)
          .describe("Preview only (default true)"),
      },
    },
    toolHandler("autoCleanup", async ({ dryRun }) =>
      engine.run({ dryRun, only: "autoCleanup" })
    )
  );

  server.registerTool(
    "autoInjectTask",
    {
      description:
        "Inject tasks for neglected goals. Checks short-term goals against open tasks — if a goal has no matching work, creates a task to maintain progress.",
      inputSchema: {
        dryRun: z
          .boolean()
          .optional()
          .default(true)
          .describe("Preview only (default true)"),
      },
    },
    toolHandler("autoInjectTask", async ({ dryRun }) =>
      engine.run({ dryRun, only: "autoInjectTask" })
    )
  );
}
