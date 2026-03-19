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

  /**
   * Ensure the repository exists on GitHub. Creates it if missing.
   * Returns true if the repo was just created, false if it already existed.
   */
  async ensureRepoExists(): Promise<boolean> {
    const log = getLogger();

    try {
      await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      log.debug("ensureRepoExists: repo already exists");
      return false;
    } catch (err: unknown) {
      const status = (err as any)?.status;
      if (status !== 404) {
        throw new GitHubApiError(
          `Failed to check repo: ${(err as Error).message}`,
          status ?? 500,
          err
        );
      }
    }

    // Repo doesn't exist — create it
    log.info("ensureRepoExists: creating repo", {
      owner: this.owner,
      repo: this.repo,
    });

    try {
      await this.octokit.repos.createForAuthenticatedUser({
        name: this.repo,
        private: true,
        description: "Personal AI brain — managed by Knowledge MCP Server",
        auto_init: true,
      });
      log.info("ensureRepoExists: repo created with initial commit");
      return true;
    } catch (err: unknown) {
      const status = (err as any)?.status;
      // 422 = repo already exists (race condition)
      if (status === 422) return false;
      throw new GitHubApiError(
        `Failed to create repo "${this.repo}": ${(err as Error).message}`,
        status ?? 500,
        err
      );
    }
  }

  /**
   * If the repo exists but has zero commits, create an initial commit
   * via the Contents API (which works on empty repos unlike Git Data API).
   */
  async bootstrapIfEmpty(): Promise<void> {
    const log = getLogger();

    try {
      await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${this.branch}`,
      });
      // Branch exists → repo has commits → nothing to do
    } catch (err: unknown) {
      const status = (err as any)?.status;
      if (status === 409 || status === 404) {
        log.info("bootstrapIfEmpty: repo is empty, creating initial commit");
        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: this.repo,
          path: "README.md",
          message: "init: bootstrap repository",
          content: Buffer.from(
            "# Brain\n\nPersonal AI brain — managed by Knowledge MCP Server.\n"
          ).toString("base64"),
          branch: this.branch,
        });
        this.invalidateAll();
        log.info("bootstrapIfEmpty: initial commit created");
      } else {
        throw new GitHubApiError(
          `Failed to check repo state: ${(err as Error).message}`,
          status ?? 500,
          err
        );
      }
    }
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

  /**
   * Create multiple files in a single commit using the Git Tree API.
   * Works on both empty repos (no commits) and existing repos.
   */
  async createFiles(
    files: Array<{ path: string; content: string }>,
    message: string
  ): Promise<void> {
    const log = getLogger();
    log.info("github.createFiles", {
      count: files.length,
      paths: files.map((f) => f.path),
    });

    // Build tree items with inline content
    const treeItems = files.map((f) => ({
      path: f.path,
      mode: "100644" as const,
      type: "blob" as const,
      content: f.content,
    }));

    let baseTreeSha: string | undefined;
    let parentSha: string | undefined;

    try {
      // Get current branch HEAD
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${this.branch}`,
      });
      parentSha = ref.object.sha;

      // Get the tree of that commit
      const { data: commit } = await this.octokit.git.getCommit({
        owner: this.owner,
        repo: this.repo,
        commit_sha: parentSha,
      });
      baseTreeSha = commit.tree.sha;
    } catch (err: unknown) {
      // Empty repo — no commits yet, that's fine
      const status = (err as any)?.status;
      if (status !== 404 && status !== 409) throw err;
      log.info("github.createFiles: empty repo, creating initial commit");
    }

    // Create tree (with base_tree if repo has commits)
    const { data: tree } = await this.octokit.git.createTree({
      owner: this.owner,
      repo: this.repo,
      tree: treeItems,
      ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
    });

    // Create commit
    const { data: newCommit } = await this.octokit.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message,
      tree: tree.sha,
      ...(parentSha ? { parents: [parentSha] } : { parents: [] }),
    });

    // Update (or create) branch ref
    try {
      await this.octokit.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${this.branch}`,
        sha: newCommit.sha,
      });
    } catch {
      // Branch doesn't exist yet — create it
      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${this.branch}`,
        sha: newCommit.sha,
      });
    }

    this.invalidateAll();
  }

  /**
   * List files in a directory. Returns file names (not content).
   * Costs 1 API call regardless of file count.
   */
  async listDirectory(path: string): Promise<string[]> {
    const log = getLogger();
    log.debug("github.listDirectory", { path });

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.branch,
      });

      if (!Array.isArray(data)) {
        throw new GitHubApiError(`Path "${path}" is not a directory`, 400);
      }

      return data
        .filter((item) => item.type === "file" && item.name.endsWith(".md"))
        .map((item) => item.name);
    } catch (err: unknown) {
      if (err instanceof GitHubApiError) throw err;
      const status = (err as any)?.status;
      if (status === 404) return [];
      throw new GitHubApiError(
        `Failed to list "${path}": ${(err as Error).message}`,
        status ?? 500,
        err
      );
    }
  }

  /**
   * List recent commits, optionally filtered by path.
   * Useful for analyzing activity patterns over time.
   */
  async listCommits(
    path?: string,
    perPage = 50
  ): Promise<Array<{ sha: string; message: string; date: string }>> {
    const log = getLogger();
    log.debug("github.listCommits", { path, perPage });

    try {
      const { data } = await this.octokit.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        sha: this.branch,
        ...(path ? { path } : {}),
        per_page: perPage,
      });

      return data.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        date: c.commit.author?.date ?? "",
      }));
    } catch (err: unknown) {
      const status = (err as any)?.status;
      if (status === 404 || status === 409) return [];
      throw new GitHubApiError(
        `Failed to list commits: ${(err as Error).message}`,
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
