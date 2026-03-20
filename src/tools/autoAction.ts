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
      description: "Run all auto-optimizations: reschedule, split, prioritize, cleanup, inject. Always dryRun=true first to preview, then false to apply. One atomic commit.",
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

  server.registerTool(
    "autoArchive",
    {
      description:
        "Archive completed tasks via auto-action engine. Moves all [x] tasks from today and backlog to archive.md with timestamps. Part of the auto-optimization system.",
      inputSchema: {
        dryRun: z
          .boolean()
          .optional()
          .default(true)
          .describe("Preview only (default true)"),
      },
    },
    toolHandler("autoArchive", async ({ dryRun }) =>
      engine.run({ dryRun, only: "autoArchive" })
    )
  );
}
