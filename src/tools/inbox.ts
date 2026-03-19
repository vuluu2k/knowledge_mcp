import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Brain } from "../core/brain.js";
import { toolHandler } from "./helpers.js";

export function registerInboxTools(server: McpServer, brain: Brain): void {
  server.registerTool(
    "getInbox",
    { description: "Get all items from the inbox/capture list" },
    toolHandler("getInbox", async () => brain.getInbox())
  );

  server.registerTool(
    "saveToInbox",
    {
      description:
        "Save a quick thought, idea, or item to the inbox for later processing",
      inputSchema: {
        content: z.string().describe("The text to capture in the inbox"),
      },
    },
    toolHandler("saveToInbox", async ({ content }) => {
      await brain.saveToInbox(content);
      return { success: true };
    })
  );
}
