import type { Brain } from "./brain.js";
import type { GitHubClient } from "../github/client.js";
import type { ActionType, AutoActionResult } from "../types/action.js";
import type { Goal } from "../types/brain.js";
import { parseTasks, removeTasksByIds, replaceTaskWithLines, appendTask, appendToArchive } from "./parser.js";
import { evaluateAllRules, type RuleContext, type RuleMutations } from "./rules.js";
import { isNotFound } from "../errors.js";
import { getLogger } from "../logger.js";

// ─── AutoActionEngine ──────────────────────────────────────

export class AutoActionEngine {
  private todayPath: string;
  private backlogPath: string;
  private archiveDir: string;

  constructor(
    private brain: Brain,
    private client: GitHubClient,
    private basePath: string
  ) {
    this.todayPath = `${basePath}/tasks/today.md`;
    this.backlogPath = `${basePath}/tasks/backlog.md`;
    this.archiveDir = `${basePath}/tasks/archive`;
  }

  private archiveMonthPath(todayStr: string): string {
    return `${this.archiveDir}/${todayStr.substring(0, 7)}.md`;
  }

  /**
   * Run auto-actions.
   * @param dryRun  — if true, simulate only (no GitHub writes)
   * @param only    — run a single action type instead of all
   * @param taskId  — target task ID (for autoSplitTask)
   */
  async run(options: {
    dryRun: boolean;
    only?: ActionType;
    taskId?: string;
  }): Promise<AutoActionResult> {
    const log = getLogger();
    const { dryRun, only, taskId } = options;

    // 1. Read raw file contents
    const [todayContent, backlogContent, shortGoals] = await Promise.all([
      this.readFile(this.todayPath),
      this.readFile(this.backlogPath),
      this.brain.getGoals("short-term").catch(() => [] as Goal[]),
    ]);

    // 2. Parse tasks
    const todayTasks = parseTasks(todayContent, "tasks/today");
    const backlogTasks = parseTasks(backlogContent, "tasks/backlog");

    // 3. Build rule context
    const ctx: RuleContext = {
      todayTasks,
      backlogTasks,
      openToday: todayTasks.filter((t) => t.status === "todo"),
      openBacklog: backlogTasks.filter((t) => t.status === "todo"),
      goals: shortGoals.map((g) => g.text),
      todayStr: new Date().toISOString().split("T")[0],
      claimed: new Set(),
    };

    // 4. Evaluate rules
    const { actions, mutations } = evaluateAllRules(ctx, only, taskId);

    log.info("autoAction:evaluate", {
      dryRun,
      only: only ?? "all",
      actionsFound: actions.length,
    });

    // 5. If dryRun or nothing to do, return
    if (dryRun || actions.length === 0) {
      return {
        dryRun: true,
        actions,
        changes: actions.flatMap((a) => a.details),
        summary:
          actions.length === 0
            ? "No actions needed — everything looks good"
            : `${actions.length} action(s) would be applied (dry run)`,
      };
    }

    // 6. Apply mutations to file contents
    let newToday = todayContent;
    let newBacklog = backlogContent;
    let archiveFile: { path: string; content: string } | undefined;

    newToday = this.applyMutations(
      newToday,
      "tasks/today",
      mutations.todayRemoveIds,
      mutations.todayReplace,
      mutations.todayAppendLines
    );

    newBacklog = this.applyMutations(
      newBacklog,
      "tasks/backlog",
      mutations.backlogRemoveIds,
      mutations.backlogReplace,
      []
    );

    // 7. Handle archive mutations
    if (mutations.archiveAppendLines.length > 0) {
      const archivePath = this.archiveMonthPath(ctx.todayStr);
      const archiveContent = await this.readFile(archivePath);
      const baseArchive = archiveContent || `# Archive — ${ctx.todayStr.substring(0, 7)}\n\n`;
      const newArchive = appendToArchive(baseArchive, mutations.archiveAppendLines, ctx.todayStr);
      if (newArchive !== archiveContent) {
        archiveFile = { path: archivePath, content: newArchive };
      }
    }

    // 8. Batch commit — only changed files
    const files: Array<{ path: string; content: string }> = [];
    if (newToday !== todayContent) {
      files.push({ path: this.todayPath, content: newToday });
    }
    if (newBacklog !== backlogContent) {
      files.push({ path: this.backlogPath, content: newBacklog });
    }
    if (archiveFile) {
      files.push(archiveFile);
    }

    if (files.length > 0) {
      await this.client.createFiles(
        files,
        "feat(ai): auto optimize tasks"
      );
      log.info("autoAction:committed", {
        files: files.map((f) => f.path),
        actions: actions.length,
      });
    }

    return {
      dryRun: false,
      actions,
      changes: actions.flatMap((a) => a.details),
      summary: `${actions.length} action(s) applied in 1 commit`,
    };
  }

  // ─── Mutation Applier ──────────────────────────────────────

  private applyMutations(
    content: string,
    source: string,
    removeIds: string[],
    replacements: Array<{ taskId: string; newLines: string[] }>,
    appendLines: string[]
  ): string {
    let result = content;

    // Apply replacements first (split tasks)
    for (const { taskId, newLines } of replacements) {
      result = replaceTaskWithLines(result, taskId, source, newLines);
    }

    // Remove tasks
    if (removeIds.length > 0) {
      result = removeTasksByIds(result, new Set(removeIds), source);
    }

    // Append new task lines
    for (const line of appendLines) {
      // appendTask expects text without "- [ ] " prefix
      const textMatch = line.match(/^- \[ \] (.+)$/);
      if (textMatch) {
        result = appendTask(result, textMatch[1]);
      } else {
        // Raw line — just append
        const base = result.endsWith("\n") ? result : result + "\n";
        result = base + line + "\n";
      }
    }

    return result;
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
