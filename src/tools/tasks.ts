import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Brain } from "../core/brain.js";
import type { Task } from "../types/task.js";
import { toolHandler } from "./helpers.js";

export function registerTaskTools(server: McpServer, brain: Brain): void {
  server.registerTool(
    "getTasks",
    {
      description:
        "Get all tasks grouped by file (today + backlog). Returns tasks with id, text, status, tags, priority, dueDate.",
      inputSchema: {
        section: z
          .enum(["today", "backlog", "all"])
          .optional()
          .default("all")
          .describe("Which task section to retrieve"),
        limit: z.number().optional().describe("Max tasks to return"),
        offset: z.number().optional().describe("Skip first N tasks"),
      },
    },
    toolHandler("getTasks", async ({ section, limit, offset }) => {
      let tasks: Task[] | { today: Task[]; backlog: Task[] };
      if (section === "all") {
        const all = await brain.getAllTasks();
        if (limit || offset) {
          const combined = [...all.today, ...all.backlog];
          const start = offset ?? 0;
          return combined.slice(start, limit ? start + limit : undefined);
        }
        return all;
      }
      tasks = await brain.getTasks(section);
      if (limit || offset) {
        const start = offset ?? 0;
        return (tasks as Task[]).slice(start, limit ? start + limit : undefined);
      }
      return tasks;
    })
  );

  server.registerTool(
    "getTodayTasks",
    { description: "Get all tasks from today's task list" },
    toolHandler("getTodayTasks", async () => brain.getTasks("today"))
  );

  server.registerTool(
    "getBacklog",
    { description: "Get all tasks from the backlog" },
    toolHandler("getBacklog", async () => brain.getTasks("backlog"))
  );

  server.registerTool(
    "addTask",
    {
      description: "Add a new task to today's list or the backlog",
      inputSchema: {
        text: z.string().describe("The task description"),
        target: z
          .enum(["today", "backlog"])
          .optional()
          .default("today")
          .describe("Where to add the task"),
      },
    },
    toolHandler("addTask", async ({ text, target }) => {
      const task = await brain.addTask(text, target);
      return { success: true, task };
    })
  );

  server.registerTool(
    "markTaskDone",
    {
      description:
        "Mark a task as complete. Provide either a taskId (from getTasks) or searchText to fuzzy-match the task.",
      inputSchema: {
        taskId: z
          .string()
          .optional()
          .describe("The task ID (from getTasks output)"),
        text: z
          .string()
          .optional()
          .describe("Text to search for in task titles (fuzzy match)"),
        section: z
          .enum(["today", "backlog"])
          .optional()
          .default("today")
          .describe("Which section the task is in"),
      },
    },
    toolHandler("markTaskDone", async ({ taskId, text, section }) => {
      if (taskId) {
        await brain.markTaskDone(section, taskId);
      } else if (text) {
        await brain.markTaskDoneByText(section, text);
      } else {
        throw new Error("Provide either taskId or text");
      }
      return { success: true };
    })
  );
}
