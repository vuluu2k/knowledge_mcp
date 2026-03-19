import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Brain } from "../core/brain.js";
import { toolHandler } from "./helpers.js";

export function registerBrainTools(server: McpServer, brain: Brain): void {
  server.registerTool(
    "initBrain",
    {
      description:
        "Initialize the brain. Automatically creates the GitHub repo (private) if it doesn't exist, then creates all folders and markdown files in a single commit. Only needs to be called once. Safe to call again — returns error if already initialized.",
    },
    toolHandler("initBrain", async () => brain.initBrain())
  );
}
