import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Brain } from "../core/brain.js";

export function registerInboxTools(server: McpServer, brain: Brain): void {
  server.registerTool("getInbox", {
    description: "Get all items from the inbox/capture list",
  }, async () => {
    try {
      const items = await brain.getInbox();
      return { content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  server.registerTool("saveToInbox", {
    description: "Save a quick thought, idea, or item to the inbox for later processing",
    inputSchema: {
      content: z.string().describe("The text to capture in the inbox"),
    },
  }, async ({ content }) => {
    try {
      await brain.saveToInbox(content);
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });
}
