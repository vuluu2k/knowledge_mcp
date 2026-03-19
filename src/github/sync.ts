import type { GitHubClient } from "./client.js";
import type { BrainSection, FileContent } from "../types/brain.js";
import { BRAIN_FILE_MAP } from "../types/brain.js";
import { ConflictError } from "../errors.js";
import { getLogger } from "../logger.js";

export type UpdateFn = (currentContent: string) => string;

export class BrainSync {
  private maxRetries: number;

  constructor(
    private client: GitHubClient,
    private basePath: string,
    maxRetries = 3
  ) {
    this.maxRetries = maxRetries;
  }

  private resolvePath(section: BrainSection): string {
    const relative = BRAIN_FILE_MAP[section];
    return `${this.basePath}/${relative}`;
  }

  async readSection(section: BrainSection): Promise<FileContent> {
    const path = this.resolvePath(section);
    return this.client.getFile(path);
  }

  async writeSection(
    section: BrainSection,
    content: string,
    sha: string,
    message: string
  ): Promise<void> {
    const path = this.resolvePath(section);
    return this.client.updateFile(path, content, sha, message);
  }

  async createSection(
    section: BrainSection,
    content: string,
    message: string
  ): Promise<void> {
    const path = this.resolvePath(section);
    return this.client.createFile(path, content, message);
  }

  /**
   * Create multiple brain files in a single commit.
   */
  async createFiles(
    files: Array<{ section: string; content: string }>,
    message: string
  ): Promise<void> {
    const mapped = files.map((f) => ({
      path: `${this.basePath}/${f.section}`,
      content: f.content,
    }));
    return this.client.createFiles(mapped, message);
  }

  /**
   * Atomic read-modify-write with automatic retry on SHA conflict.
   * The `updateFn` receives current file content and returns the new content.
   * On 409 Conflict, re-reads the file and re-applies the update.
   */
  async atomicUpdate(
    section: BrainSection,
    updateFn: UpdateFn,
    message: string
  ): Promise<FileContent> {
    const log = getLogger();
    const path = this.resolvePath(section);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      // Always bypass cache for write operations
      const file = await this.client.getFile(path, true);
      const newContent = updateFn(file.content);

      // No change needed
      if (newContent === file.content) {
        log.debug("atomicUpdate: no change", { path });
        return file;
      }

      try {
        await this.client.updateFile(path, newContent, file.sha, message);
        log.info("atomicUpdate: success", { path, attempt });
        return { content: newContent, sha: "", path };
      } catch (err) {
        if (err instanceof ConflictError && attempt < this.maxRetries) {
          log.warn("atomicUpdate: conflict, retrying", { path, attempt });
          continue;
        }
        throw err;
      }
    }

    // Should not reach here, but just in case
    throw new ConflictError(path);
  }
}
