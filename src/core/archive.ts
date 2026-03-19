import type { GitHubClient } from "../github/client.js";
import { parseTasks, removeTasksByIds, appendToArchive } from "./parser.js";
import { isNotFound } from "../errors.js";
import { getLogger } from "../logger.js";

// ─── Types ──────────────────────────────────────────────────

export interface ArchiveResult {
  archivedCount: number;
  fromToday: number;
  fromBacklog: number;
  tasks: Array<{ text: string; source: string; archivedAt: string }>;
}

// ─── ArchiveEngine ──────────────────────────────────────────

export class ArchiveEngine {
  private todayPath: string;
  private backlogPath: string;
  private archivePath: string;

  constructor(
    private client: GitHubClient,
    private basePath: string
  ) {
    this.todayPath = `${basePath}/tasks/today.md`;
    this.backlogPath = `${basePath}/tasks/backlog.md`;
    this.archivePath = `${basePath}/tasks/archive.md`;
  }

  /**
   * Move all completed [x] tasks from today + backlog into archive.md.
   * All changes in one atomic commit.
   */
  async archiveDoneTasks(): Promise<ArchiveResult> {
    const log = getLogger();

    // 1. Read all files in parallel
    const [todayContent, backlogContent, archiveContent] = await Promise.all([
      this.readFile(this.todayPath),
      this.readFile(this.backlogPath),
      this.readFile(this.archivePath),
    ]);

    // 2. Parse and find done tasks
    const todayTasks = parseTasks(todayContent, "tasks/today");
    const backlogTasks = parseTasks(backlogContent, "tasks/backlog");

    const doneTodayTasks = todayTasks.filter((t) => t.status === "done");
    const doneBacklogTasks = backlogTasks.filter((t) => t.status === "done");

    const allDone = [...doneTodayTasks, ...doneBacklogTasks];

    if (allDone.length === 0) {
      return {
        archivedCount: 0,
        fromToday: 0,
        fromBacklog: 0,
        tasks: [],
      };
    }

    // 3. Build archive entries
    const now = new Date().toISOString().replace("T", " ").split(".")[0];
    const todayStr = new Date().toISOString().split("T")[0];
    const archiveLines = allDone.map(
      (t) => `${t.rawLine} — archived ${now} from ${t.source}`
    );

    // 4. Remove done tasks from source files
    const todayDoneIds = new Set(doneTodayTasks.map((t) => t.id));
    const backlogDoneIds = new Set(doneBacklogTasks.map((t) => t.id));

    const newToday = todayDoneIds.size > 0
      ? removeTasksByIds(todayContent, todayDoneIds, "tasks/today")
      : todayContent;

    const newBacklog = backlogDoneIds.size > 0
      ? removeTasksByIds(backlogContent, backlogDoneIds, "tasks/backlog")
      : backlogContent;

    // 5. Append to archive
    const baseArchive = archiveContent || "# Archive\n\nCompleted tasks are archived here by date.\n";
    const newArchive = appendToArchive(baseArchive, archiveLines, todayStr);

    // 6. Batch commit only changed files
    const files: Array<{ path: string; content: string }> = [];
    if (newToday !== todayContent) {
      files.push({ path: this.todayPath, content: newToday });
    }
    if (newBacklog !== backlogContent) {
      files.push({ path: this.backlogPath, content: newBacklog });
    }
    files.push({ path: this.archivePath, content: newArchive });

    await this.client.createFiles(
      files,
      `feat(ai): archive ${allDone.length} completed task(s)`
    );

    const result: ArchiveResult = {
      archivedCount: allDone.length,
      fromToday: doneTodayTasks.length,
      fromBacklog: doneBacklogTasks.length,
      tasks: allDone.map((t) => ({
        text: t.text,
        source: t.source,
        archivedAt: now,
      })),
    };

    log.info("archiveDoneTasks", { archivedCount: result.archivedCount });
    return result;
  }

  /**
   * Read archive contents.
   */
  async getArchive(): Promise<string> {
    const content = await this.readFile(this.archivePath);
    if (!content) {
      return "No archive yet. Use archiveDoneTasks to archive completed tasks.";
    }
    return content;
  }

  // ─── File Reader ─────────────────────────────────────────

  private async readFile(path: string): Promise<string> {
    try {
      const file = await this.client.getFile(path, true);
      return file.content;
    } catch (err) {
      if (isNotFound(err)) return "";
      throw err;
    }
  }
}
