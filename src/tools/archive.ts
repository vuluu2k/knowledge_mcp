import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ArchiveEngine } from "../core/archive.js";
import { toolHandler } from "./helpers.js";

export function registerArchiveTools(
  server: McpServer,
  engine: ArchiveEngine
): void {
  server.registerTool(
    "archiveDoneTasks",
    {
      description:
        "Move all completed [x] tasks from today.md and backlog.md into a monthly archive file (tasks/archive/YYYY-MM.md), grouped by date with timestamps. Returns count of archived tasks. All changes in one atomic git commit. Use this when the user says 'archive', 'clean up done tasks', 'move completed tasks', 'dọn tasks đã xong', 'lưu trữ tasks hoàn thành'.",
      inputSchema: {},
    },
    toolHandler("archiveDoneTasks", async () => engine.archiveDoneTasks())
  );

  server.registerTool(
    "getArchive",
    {
      description:
        "Read the task archive for a specific month. Defaults to current month. Use when the user asks 'what did I finish?', 'show archive', 'xem lịch sử hoàn thành', 'tôi đã làm gì tháng trước?'.",
      inputSchema: {
        month: z
          .string()
          .optional()
          .describe("Month to read in YYYY-MM format (e.g., '2026-03'). Defaults to current month."),
      },
    },
    toolHandler("getArchive", async ({ month }) => engine.getArchive(month))
  );

  server.registerTool(
    "listArchiveMonths",
    {
      description:
        "List all available archive months. Returns months sorted newest first. Use to discover which months have archived data.",
      inputSchema: {},
    },
    toolHandler("listArchiveMonths", async () => engine.listArchiveMonths())
  );
}
