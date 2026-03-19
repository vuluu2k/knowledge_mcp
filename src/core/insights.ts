import type { Brain } from "./brain.js";
import type { GitHubClient } from "../github/client.js";
import type { Task } from "../types/task.js";
import type { Goal } from "../types/brain.js";
import { getLogger } from "../logger.js";

// ─── Types ─────────────────────────────────────────────────

export interface TaskStats {
  today: { total: number; done: number; todo: number };
  backlog: { total: number; done: number; todo: number };
  completionRate: number;
}

export interface TaskQualityIssue {
  taskId: string;
  text: string;
  source: string;
  issues: string[];
}

export interface OverdueTask {
  id: string;
  text: string;
  dueDate: string;
  daysOverdue: number;
  source: string;
}

export interface ActivityPattern {
  byHour: Record<number, number>;
  byDayOfWeek: Record<string, number>;
  recentWeekCommits: number;
  totalCommits: number;
  lastActivityDate: string | null;
  mostActiveHour: number | null;
  mostActiveDay: string | null;
}

export interface InsightReport {
  generatedAt: string;
  taskStats: TaskStats;
  taskQualityIssues: TaskQualityIssue[];
  overdueTasks: OverdueTask[];
  activityPattern: ActivityPattern;
  goals: { shortTerm: string[]; longTerm: string[] };
  todayTasks: Array<{
    text: string;
    status: string;
    priority?: string;
    tags: string[];
    dueDate?: string;
  }>;
  backlogTasks: Array<{
    text: string;
    status: string;
    priority?: string;
    tags: string[];
    dueDate?: string;
  }>;
  inboxPendingCount: number;
}

// ─── Day names ─────────────────────────────────────────────

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ─── InsightsEngine ────────────────────────────────────────

export class InsightsEngine {
  constructor(
    private brain: Brain,
    private client: GitHubClient,
    private basePath: string
  ) {}

  async generateReport(): Promise<InsightReport> {
    const log = getLogger();

    const [allTasks, shortTermGoals, longTermGoals, inbox, commits] =
      await Promise.all([
        this.brain.getAllTasks(),
        this.brain.getGoals("short-term").catch(() => [] as Goal[]),
        this.brain.getGoals("long-term").catch(() => [] as Goal[]),
        this.brain.getInbox().catch(() => []),
        this.client.listCommits(this.basePath, 100).catch(() => []),
      ]);

    const combined = [...allTasks.today, ...allTasks.backlog];

    const report: InsightReport = {
      generatedAt: new Date().toISOString(),
      taskStats: this.computeTaskStats(allTasks.today, allTasks.backlog),
      taskQualityIssues: this.analyzeTaskQuality(combined),
      overdueTasks: this.findOverdueTasks(combined),
      activityPattern: this.analyzeActivity(commits),
      goals: {
        shortTerm: shortTermGoals.map((g) => g.text),
        longTerm: longTermGoals.map((g) => g.text),
      },
      todayTasks: allTasks.today.map((t) => ({
        text: t.text,
        status: t.status,
        priority: t.priority,
        tags: t.tags,
        dueDate: t.dueDate,
      })),
      backlogTasks: allTasks.backlog.map((t) => ({
        text: t.text,
        status: t.status,
        priority: t.priority,
        tags: t.tags,
        dueDate: t.dueDate,
      })),
      inboxPendingCount: inbox.length,
    };

    log.info("generateInsightReport", {
      totalTasks: combined.length,
      commits: commits.length,
    });

    return report;
  }

  private computeTaskStats(today: Task[], backlog: Task[]): TaskStats {
    const todayDone = today.filter((t) => t.status === "done").length;
    const backlogDone = backlog.filter((t) => t.status === "done").length;
    const total = today.length + backlog.length;
    const done = todayDone + backlogDone;

    return {
      today: {
        total: today.length,
        done: todayDone,
        todo: today.length - todayDone,
      },
      backlog: {
        total: backlog.length,
        done: backlogDone,
        todo: backlog.length - backlogDone,
      },
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }

  private analyzeTaskQuality(tasks: Task[]): TaskQualityIssue[] {
    const issues: TaskQualityIssue[] = [];

    for (const task of tasks) {
      if (task.status === "done") continue;

      const taskIssues: string[] = [];

      if (!task.priority) taskIssues.push("no-priority");
      if (!task.dueDate) taskIssues.push("no-due-date");
      if (task.tags.length === 0) taskIssues.push("no-tags");

      const wordCount = task.text.split(/\s+/).length;
      if (wordCount <= 3) taskIssues.push("vague-description");

      if (taskIssues.length > 0) {
        issues.push({
          taskId: task.id,
          text: task.text,
          source: task.source,
          issues: taskIssues,
        });
      }
    }

    return issues;
  }

  private findOverdueTasks(tasks: Task[]): OverdueTask[] {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const overdue: OverdueTask[] = [];

    for (const task of tasks) {
      if (task.status === "done" || !task.dueDate) continue;
      if (task.dueDate < todayStr) {
        const due = new Date(task.dueDate);
        const daysOverdue = Math.floor(
          (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
        );
        overdue.push({
          id: task.id,
          text: task.text,
          dueDate: task.dueDate,
          daysOverdue,
          source: task.source,
        });
      }
    }

    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return overdue;
  }

  private analyzeActivity(
    commits: Array<{ sha: string; message: string; date: string }>
  ): ActivityPattern {
    const byHour: Record<number, number> = {};
    const byDayOfWeek: Record<string, number> = {};
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    let recentWeekCommits = 0;
    let lastActivityDate: string | null = null;

    for (const c of commits) {
      if (!c.date) continue;
      const d = new Date(c.date);
      if (isNaN(d.getTime())) continue;

      const hour = d.getHours();
      const day = DAY_NAMES[d.getDay()];

      byHour[hour] = (byHour[hour] ?? 0) + 1;
      byDayOfWeek[day] = (byDayOfWeek[day] ?? 0) + 1;

      if (now - d.getTime() < oneWeekMs) recentWeekCommits++;
      if (!lastActivityDate || c.date > lastActivityDate) {
        lastActivityDate = c.date;
      }
    }

    let mostActiveHour: number | null = null;
    let maxHourCount = 0;
    for (const [h, count] of Object.entries(byHour)) {
      if (count > maxHourCount) {
        maxHourCount = count;
        mostActiveHour = Number(h);
      }
    }

    let mostActiveDay: string | null = null;
    let maxDayCount = 0;
    for (const [day, count] of Object.entries(byDayOfWeek)) {
      if (count > maxDayCount) {
        maxDayCount = count;
        mostActiveDay = day;
      }
    }

    return {
      byHour,
      byDayOfWeek,
      recentWeekCommits,
      totalCommits: commits.length,
      lastActivityDate,
      mostActiveHour,
      mostActiveDay,
    };
  }
}
