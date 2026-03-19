import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Brain } from "../core/brain.js";
import { toolHandler } from "./helpers.js";

export function registerNoteTools(server: McpServer, brain: Brain): void {
  server.registerTool(
    "getNotes",
    {
      description: "Get notes from the ideas or learning section",
      inputSchema: {
        section: z
          .enum(["ideas", "learning"])
          .optional()
          .default("ideas")
          .describe("Which notes section to retrieve"),
      },
    },
    toolHandler("getNotes", async ({ section }) => brain.getNotes(section))
  );

  server.registerTool(
    "addNote",
    {
      description: "Add a note to the ideas or learning section",
      inputSchema: {
        content: z.string().describe("The note content"),
        file: z
          .enum(["ideas", "learning"])
          .optional()
          .default("ideas")
          .describe("Which section to add the note to"),
      },
    },
    toolHandler("addNote", async ({ content, file }) => {
      await brain.addNote(content, file);
      return { success: true };
    })
  );

  server.registerTool(
    "getGoals",
    {
      description: "Get goals from short-term or long-term sections",
      inputSchema: {
        section: z
          .enum(["short-term", "long-term"])
          .optional()
          .default("short-term")
          .describe("Which goals section to retrieve"),
      },
    },
    toolHandler("getGoals", async ({ section }) => brain.getGoals(section))
  );
}
