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

export interface ArchiveMonth {
  month: string; // "2026-03"
  file: string;  // "tasks/archive/2026-03.md"
}

// ─── ArchiveEngine ──────────────────────────────────────────

export class ArchiveEngine {
  private todayPath: string;
  private backlogPath: string;
  private archiveDir: string;

  constructor(
    private client: GitHubClient,
    private basePath: string
  ) {
    this.todayPath = `${basePath}/tasks/today.md`;
    this.backlogPath = `${basePath}/tasks/backlog.md`;
    this.archiveDir = `${basePath}/tasks/archive`;
  }

  /** Path for a given month's archive file */
  private monthPath(yearMonth: string): string {
    return `${this.archiveDir}/${yearMonth}.md`;
  }

  /**
   * Move all completed [x] tasks from today + backlog into monthly archive file.
   * All changes in one atomic commit.
   */
  async archiveDoneTasks(): Promise<ArchiveResult> {
    const log = getLogger();

    // 1. Read source files in parallel
    const [todayContent, backlogContent] = await Promise.all([
      this.readFile(this.todayPath),
      this.readFile(this.backlogPath),
    ]);

    // 2. Parse and find done tasks
    const todayTasks = parseTasks(todayContent, "tasks/today");
    const backlogTasks = parseTasks(backlogContent, "tasks/backlog");

    const doneTodayTasks = todayTasks.filter((t) => t.status === "done");
    const doneBacklogTasks = backlogTasks.filter((t) => t.status === "done");

    const allDone = [...doneTodayTasks, ...doneBacklogTasks];

    if (allDone.length === 0) {
      return { archivedCount: 0, fromToday: 0, fromBacklog: 0, tasks: [] };
    }

    // 3. Build archive entries
    const now = new Date();
    const nowStr = now.toISOString().replace("T", " ").split(".")[0];
    const todayStr = now.toISOString().split("T")[0];
    const yearMonth = todayStr.substring(0, 7); // "2026-03"

    const archiveLines = allDone.map(
      (t) => `${t.rawLine} — archived ${nowStr} from ${t.source}`
    );

    // 4. Read current month's archive file
    const archiveFilePath = this.monthPath(yearMonth);
    const archiveContent = await this.readFile(archiveFilePath);

    // 5. Remove done tasks from source files
    const todayDoneIds = new Set(doneTodayTasks.map((t) => t.id));
    const backlogDoneIds = new Set(doneBacklogTasks.map((t) => t.id));

    const newToday = todayDoneIds.size > 0
      ? removeTasksByIds(todayContent, todayDoneIds, "tasks/today")
      : todayContent;

    const newBacklog = backlogDoneIds.size > 0
      ? removeTasksByIds(backlogContent, backlogDoneIds, "tasks/backlog")
      : backlogContent;

    // 6. Append to monthly archive
    const baseArchive = archiveContent || `# Archive — ${yearMonth}\n\n`;
    const newArchive = appendToArchive(baseArchive, archiveLines, todayStr);

    // 7. Batch commit only changed files
    const files: Array<{ path: string; content: string }> = [];
    if (newToday !== todayContent) {
      files.push({ path: this.todayPath, content: newToday });
    }
    if (newBacklog !== backlogContent) {
      files.push({ path: this.backlogPath, content: newBacklog });
    }
    files.push({ path: archiveFilePath, content: newArchive });

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
        archivedAt: nowStr,
      })),
    };

    log.info("archiveDoneTasks", { archivedCount: result.archivedCount });
    return result;
  }

  /**
   * List all available archive months.
   */
  async listArchiveMonths(): Promise<ArchiveMonth[]> {
    try {
      const files = await this.client.listDirectory(this.archiveDir);
      return files
        .filter((f) => f.endsWith(".md"))
        .map((f) => {
          const month = f.replace(".md", "");
          return { month, file: `${this.archiveDir}/${f}` };
        })
        .sort((a, b) => b.month.localeCompare(a.month)); // newest first
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  /**
   * Read archive for a specific month, or current month if not specified.
   */
  async getArchive(month?: string): Promise<string> {
    const targetMonth = month || new Date().toISOString().split("T")[0].substring(0, 7);
    const content = await this.readFile(this.monthPath(targetMonth));

    if (!content) {
      // List available months to help user
      const months = await this.listArchiveMonths();
      if (months.length === 0) {
        return "No archive yet. Use archiveDoneTasks to archive completed tasks.";
      }
      return `No archive for ${targetMonth}. Available months: ${months.map((m) => m.month).join(", ")}`;
    }

    return content;
  }

  /**
   * Get the archive file path for the current month (used by autoAction).
   */
  getCurrentMonthPath(): string {
    const yearMonth = new Date().toISOString().split("T")[0].substring(0, 7);
    return this.monthPath(yearMonth);
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
