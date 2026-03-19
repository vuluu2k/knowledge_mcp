import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Brain } from "./core/brain.js";
import type { KnowledgeBase } from "./core/knowledge.js";
import { registerBrainTools } from "./tools/brain.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerInboxTools } from "./tools/inbox.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";

export function createServer(brain: Brain, kb: KnowledgeBase): McpServer {
  const server = new McpServer({
    name: "knowledge-brain",
    version: "1.0.0",
  });

  registerBrainTools(server, brain);
  registerTaskTools(server, brain);
  registerNoteTools(server, brain);
  registerInboxTools(server, brain);
  registerKnowledgeTools(server, kb);

  return server;
}
