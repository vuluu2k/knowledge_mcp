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
        "Move all completed [x] tasks from today.md and backlog.md into archive.md, grouped by date with timestamps. Returns count of archived tasks. All changes in one atomic git commit. Use this when the user says 'archive', 'clean up done tasks', 'move completed tasks', 'dọn tasks đã xong', 'lưu trữ tasks hoàn thành'.",
      inputSchema: {},
    },
    toolHandler("archiveDoneTasks", async () => engine.archiveDoneTasks())
  );

  server.registerTool(
    "getArchive",
    {
      description:
        "Read the task archive — completed tasks grouped by date. Use when the user asks 'what did I finish?', 'show archive', 'xem lịch sử hoàn thành', 'tôi đã làm gì tuần trước?'.",
      inputSchema: {},
    },
    toolHandler("getArchive", async () => engine.getArchive())
  );
}
