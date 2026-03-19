#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp.js";
import { GitHubClient } from "./github/client.js";
import { BrainSync } from "./github/sync.js";
import { Brain } from "./core/brain.js";
import { loadConfig } from "./config.js";

async function main() {
  const config = loadConfig();

  const githubClient = new GitHubClient({
    token: config.githubToken,
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
  });

  const sync = new BrainSync(githubClient, config.basePath);
  const brain = new Brain(sync);
  const server = createServer(brain);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
