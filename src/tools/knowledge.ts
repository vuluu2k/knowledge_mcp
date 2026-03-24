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
        "List all knowledge topics with name, description, and tags. No entry content is returned — use this to discover what exists before reading.",
    },
    toolHandler("listTopics", async () => kb.listTopics())
  );

  server.registerTool(
    "getKnowledge",
    {
      description:
        "Get all entries from a specific knowledge topic. Returns metadata + all entries.",
      inputSchema: {
        topic: z.string().describe("Topic file name (e.g. chinh-sach-ban-hang, docker, git)"),
      },
    },
    toolHandler("getKnowledge", async ({ topic }) => kb.getTopic(topic))
  );

  server.registerTool(
    "addKnowledge",
    {
      description:
        "Add a new knowledge entry to a topic. Creates the topic file with frontmatter if it doesn't exist.",
      inputSchema: {
        topic: z.string().describe("Topic file name (e.g. chinh-sach-ban-hang, docker)"),
        title: z.string().describe("Entry title (becomes ## heading)"),
        content: z.string().describe("Entry content (markdown)"),
        description: z
          .string()
          .optional()
          .describe("Topic description (only used when creating new topic)"),
        tags: z
          .string()
          .optional()
          .describe("Comma-separated tags (only used when creating new topic)"),
      },
    },
    toolHandler("addKnowledge", async ({ topic, title, content, description, tags }) =>
      kb.addKnowledge(
        topic,
        title,
        content,
        description,
        tags ? tags.split(",").map((t: string) => t.trim()) : undefined
      )
    )
  );

  server.registerTool(
    "searchKnowledge",
    {
      description:
        "Search across all knowledge topics by keyword. Matches against tags, entry titles, and content. Tag matches rank first.",
      inputSchema: {
        query: z.string().describe("Search keyword or phrase"),
        limit: z.number().optional().default(20).describe("Max results (default 20)"),
      },
    },
    toolHandler("searchKnowledge", async ({ query, limit }) =>
      kb.searchKnowledge(query, limit)
    )
  );

  server.registerTool(
    "updateKnowledge",
    {
      description:
        "Update an existing knowledge entry (matched by title). Use after adding content to the wrong topic.",
      inputSchema: {
        topic: z.string().describe("Topic file name (e.g. chinh-sach-ban-hang, docker)"),
        title: z.string().describe("Exact title of the entry to update"),
        content: z.string().describe("New entry content (markdown)"),
      },
    },
    toolHandler("updateKnowledge", async ({ topic, title, content }) =>
      kb.updateKnowledgeEntry(topic, title, content)
    )
  );

  server.registerTool(
    "deleteKnowledge",
    {
      description:
        "Delete a knowledge entry by title from a topic. Use to remove stale or moved entries.",
      inputSchema: {
        topic: z.string().describe("Topic file name (e.g. chinh-sach-ban-hang, docker)"),
        title: z.string().describe("Exact title of the entry to delete"),
      },
    },
    toolHandler("deleteKnowledge", async ({ topic, title }) =>
      kb.deleteKnowledgeEntry(topic, title)
    )
  );
}
