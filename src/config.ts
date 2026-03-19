import "dotenv/config";
import type { LogLevel } from "./logger.js";

export interface Config {
  githubToken: string;
  owner: string;
  repo: string;
  branch: string;
  basePath: string;
  logLevel: LogLevel;
  cacheTtlMs: number;
  writeRetries: number;
}

export function loadConfig(): Config {
  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!githubToken || !owner || !repo) {
    throw new Error(
      "Missing required env vars: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO"
    );
  }

  return {
    githubToken,
    owner,
    repo,
    branch: process.env.GITHUB_BRANCH || "main",
    basePath: process.env.BRAIN_BASE_PATH || "brain",
    logLevel: (process.env.LOG_LEVEL as LogLevel) || "info",
    cacheTtlMs: parseInt(process.env.CACHE_TTL_MS || "30000", 10),
    writeRetries: parseInt(process.env.WRITE_RETRIES || "3", 10),
  };
}
