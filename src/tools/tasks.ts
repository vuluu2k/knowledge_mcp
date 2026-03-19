import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Brain } from "../core/brain.js";

export function registerTaskTools(server: McpServer, brain: Brain): void {
  server.registerTool("getTasks", {
    description: "Get all tasks grouped by file (today + backlog). Returns tasks with id, text, status, tags.",
    inputSchema: {
      section: z
        .enum(["today", "backlog", "all"])
        .optional()
        .default("all")
        .describe("Which task section to retrieve"),
    },
  }, async ({ section }) => {
    try {
      if (section === "all") {
        const all = await brain.getAllTasks();
        return { content: [{ type: "text" as const, text: JSON.stringify(all, null, 2) }] };
      }
      const tasks = await brain.getTasks(section);
      return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  server.registerTool("getTodayTasks", {
    description: "Get all tasks from today's task list",
  }, async () => {
    try {
      const tasks = await brain.getTasks("today");
      return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  server.registerTool("getBacklog", {
    description: "Get all tasks from the backlog",
  }, async () => {
    try {
      const tasks = await brain.getTasks("backlog");
      return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  server.registerTool("addTask", {
    description: "Add a new task to today's list or the backlog",
    inputSchema: {
      text: z.string().describe("The task description"),
      target: z
        .enum(["today", "backlog"])
        .optional()
        .default("today")
        .describe("Where to add the task"),
    },
  }, async ({ text, target }) => {
    try {
      const task = await brain.addTask(text, target);
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, task }, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  server.registerTool("markTaskDone", {
    description: "Mark a task as complete. Provide either a taskId (from getTasks) or searchText to fuzzy-match the task.",
    inputSchema: {
      taskId: z.string().optional().describe("The task ID (from getTasks output)"),
      text: z.string().optional().describe("Text to search for in task titles (fuzzy match)"),
      section: z
        .enum(["today", "backlog"])
        .optional()
        .default("today")
        .describe("Which section the task is in"),
    },
  }, async ({ taskId, text, section }) => {
    try {
      if (taskId) {
        await brain.markTaskDone(section, taskId);
      } else if (text) {
        await brain.markTaskDoneByText(section, text);
      } else {
        return {
          content: [{ type: "text" as const, text: "Error: Provide either taskId or text" }],
          isError: true,
        };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });
}
