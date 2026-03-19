import { Octokit } from "@octokit/rest";
import type { FileContent } from "../types/brain.js";
import { NotFoundError, ConflictError, GitHubApiError } from "../errors.js";
import { getLogger } from "../logger.js";

interface CacheEntry {
  file: FileContent;
  expiresAt: number;
}

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private branch: string;
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs: number;

  constructor(config: {
    token: string;
    owner: string;
    repo: string;
    branch: string;
    cacheTtlMs?: number;
  }) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
    this.branch = config.branch;
    this.cacheTtlMs = config.cacheTtlMs ?? 30_000;
  }

  async getFile(path: string, skipCache = false): Promise<FileContent> {
    const log = getLogger();

    if (!skipCache) {
      const cached = this.cache.get(path);
      if (cached && Date.now() < cached.expiresAt) {
        log.debug("cache hit", { path });
        return cached.file;
      }
    }

    log.debug("github.getFile", { path });
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.branch,
      });

      if (Array.isArray(data) || data.type !== "file") {
        throw new GitHubApiError(`Path "${path}" is not a file`, 400);
      }

      const content = Buffer.from(data.content, "base64").toString("utf-8");
      const file: FileContent = { content, sha: data.sha, path };

      this.cache.set(path, {
        file,
        expiresAt: Date.now() + this.cacheTtlMs,
      });

      return file;
    } catch (err: unknown) {
      if (err instanceof GitHubApiError) throw err;
      const status = (err as any)?.status;
      if (status === 404) throw new NotFoundError(path);
      if (status === 403) {
        throw new GitHubApiError(
          "Rate limited or forbidden — check your token permissions",
          403,
          err
        );
      }
      throw new GitHubApiError(
        `Failed to read "${path}": ${(err as Error).message}`,
        status ?? 500,
        err
      );
    }
  }

  async updateFile(
    path: string,
    content: string,
    sha: string,
    message: string
  ): Promise<void> {
    const log = getLogger();
    log.debug("github.updateFile", { path, message });

    try {
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
        sha,
        branch: this.branch,
      });
      // Invalidate cache after successful write
      this.invalidate(path);
    } catch (err: unknown) {
      const status = (err as any)?.status;
      if (status === 409) throw new ConflictError(path);
      throw new GitHubApiError(
        `Failed to update "${path}": ${(err as Error).message}`,
        status ?? 500,
        err
      );
    }
  }

  async createFile(
    path: string,
    content: string,
    message: string
  ): Promise<void> {
    const log = getLogger();
    log.debug("github.createFile", { path, message });

    try {
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
        branch: this.branch,
      });
      this.invalidate(path);
    } catch (err: unknown) {
      const status = (err as any)?.status;
      throw new GitHubApiError(
        `Failed to create "${path}": ${(err as Error).message}`,
        status ?? 500,
        err
      );
    }
  }

  invalidate(path: string) {
    this.cache.delete(path);
  }

  invalidateAll() {
    this.cache.clear();
  }
}
