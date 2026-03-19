import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KnowledgeBase } from "../core/knowledge.js";
import { toolHandler } from "./helpers.js";

export function registerKnowledgeTools(
  server: McpServer,
  kb: KnowledgeBase
): void {
  server.registerTool(
    "listTopics",
    {
      description:
        "List all knowledge topics. Returns topic names only (no content). Use this first to discover what knowledge exists before reading.",
    },
    toolHandler("listTopics", async () => kb.listTopics())
  );

  server.registerTool(
    "getKnowledge",
    {
      description:
        "Get all entries from a specific knowledge topic. Use listTopics first to see available topics.",
      inputSchema: {
        topic: z.string().describe("Topic name (e.g. typescript, docker, project-setup)"),
      },
    },
    toolHandler("getKnowledge", async ({ topic }) => kb.getTopic(topic))
  );

  server.registerTool(
    "addKnowledge",
    {
      description:
        "Add a new knowledge entry to a topic. Creates the topic if it doesn't exist. Use this to store facts, how-tos, decisions, or anything worth remembering.",
      inputSchema: {
        topic: z.string().describe("Topic name (e.g. typescript, docker, recipes)"),
        title: z.string().describe("Entry title / question"),
        content: z.string().describe("Entry content / answer / explanation"),
      },
    },
    toolHandler("addKnowledge", async ({ topic, title, content }) =>
      kb.addKnowledge(topic, title, content)
    )
  );

  server.registerTool(
    "searchKnowledge",
    {
      description:
        "Search across all knowledge topics by keyword. Returns matching entries with their topic, title, and content.",
      inputSchema: {
        query: z.string().describe("Search keyword or phrase"),
      },
    },
    toolHandler("searchKnowledge", async ({ query }) =>
      kb.searchKnowledge(query)
    )
  );
}
