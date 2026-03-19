import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Brain } from "./core/brain.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerInboxTools } from "./tools/inbox.js";

export function createServer(brain: Brain): McpServer {
  const server = new McpServer({
    name: "knowledge-brain",
    version: "1.0.0",
  });

  registerTaskTools(server, brain);
  registerNoteTools(server, brain);
  registerInboxTools(server, brain);

  return server;
}
