import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Brain } from "../core/brain.js";

export function registerNoteTools(server: McpServer, brain: Brain): void {
  server.registerTool("getNotes", {
    description: "Get notes from the ideas or learning section",
    inputSchema: {
      section: z
        .enum(["ideas", "learning"])
        .optional()
        .default("ideas")
        .describe("Which notes section to retrieve"),
    },
  }, async ({ section }) => {
    try {
      const notes = await brain.getNotes(section);
      return { content: [{ type: "text" as const, text: JSON.stringify(notes, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  server.registerTool("addNote", {
    description: "Add a note to the ideas or learning section",
    inputSchema: {
      content: z.string().describe("The note content"),
      file: z
        .enum(["ideas", "learning"])
        .optional()
        .default("ideas")
        .describe("Which section to add the note to"),
    },
  }, async ({ content, file }) => {
    try {
      await brain.addNote(content, file);
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  server.registerTool("getGoals", {
    description: "Get goals from short-term or long-term sections",
    inputSchema: {
      section: z
        .enum(["short-term", "long-term"])
        .optional()
        .default("short-term")
        .describe("Which goals section to retrieve"),
    },
  }, async ({ section }) => {
    try {
      const goals = await brain.getGoals(section);
      return { content: [{ type: "text" as const, text: JSON.stringify(goals, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });
}
