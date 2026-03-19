#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp.js";
import { GitHubClient } from "./github/client.js";
import { BrainSync } from "./github/sync.js";
import { Brain } from "./core/brain.js";
import { KnowledgeBase } from "./core/knowledge.js";
import { InsightsEngine } from "./core/insights.js";
import { ContextEngine } from "./core/context.js";
import { StatsEngine } from "./core/stats.js";
import { loadConfig } from "./config.js";
import { Logger } from "./logger.js";

async function main() {
  const config = loadConfig();
  const log = new Logger(config.logLevel);

  log.info("starting knowledge-brain MCP server", {
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    basePath: config.basePath,
    cacheTtlMs: config.cacheTtlMs,
    writeRetries: config.writeRetries,
  });

  const githubClient = new GitHubClient({
    token: config.githubToken,
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    cacheTtlMs: config.cacheTtlMs,
  });

  const sync = new BrainSync(githubClient, config.basePath, config.writeRetries);
  const brain = new Brain(sync);
  const kb = new KnowledgeBase(githubClient, config.basePath, config.writeRetries);
  const insights = new InsightsEngine(brain, githubClient, config.basePath);
  const context = new ContextEngine(brain);
  const stats = new StatsEngine(brain, githubClient, config.basePath);
  const server = createServer(brain, kb, insights, context, stats);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info("MCP server connected via stdio");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
