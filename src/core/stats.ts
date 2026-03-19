import type { Brain } from "./brain.js";
import type { GitHubClient } from "../github/client.js";
import type { Task } from "../types/task.js";
import { getLogger } from "../logger.js";

// ─── Types ─────────────────────────────────────────────────

export interface BehaviorStats {
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  avgTasksPerDay: number;
  mostActiveHour: string | null;
  mostActiveDay: string | null;
  staleTasks: Array<{
    id: string;
    text: string;
    source: string;
    reason: string;
  }>;
  estimateAccuracy: {
    tasksWithEstimate: number;
    totalEstimateMinutes: number;
  };
  tagDistribution: Record<string, number>;
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

// ─── StatsEngine ───────────────────────────────────────────

export class StatsEngine {
  constructor(
    private brain: Brain,
    private client: GitHubClient,
    private basePath: string
  ) {}

  async getStats(): Promise<BehaviorStats> {
    const log = getLogger();

    const [allTasks, commits] = await Promise.all([
      this.brain.getAllTasks(),
      this.client.listCommits(this.basePath, 100).catch(() => []),
    ]);

    const combined = [...allTasks.today, ...allTasks.backlog];
    const done = combined.filter((t) => t.status === "done");
    const open = combined.filter((t) => t.status === "todo");
    const total = combined.length;

    const completionRate =
      total > 0 ? Math.round((done.length / total) * 100) : 0;

    // Activity analysis from commits
    const { mostActiveHour, mostActiveDay, avgTasksPerDay } =
      this.analyzeCommits(commits);

    // Stale tasks: overdue 7+ days OR in backlog with no priority + no due date
    const staleTasks = this.findStaleTasks(open);

    // Tag distribution
    const tagDist: Record<string, number> = {};
    for (const t of combined) {
      for (const tag of t.tags) {
        tagDist[tag] = (tagDist[tag] ?? 0) + 1;
      }
    }

    // Estimate stats
    const withEstimate = combined.filter((t) => t.estimate !== undefined);
    const totalEstimate = withEstimate.reduce(
      (sum, t) => sum + (t.estimate ?? 0),
      0
    );

    const stats: BehaviorStats = {
      completionRate,
      totalTasks: total,
      completedTasks: done.length,
      openTasks: open.length,
      avgTasksPerDay,
      mostActiveHour,
      mostActiveDay,
      staleTasks,
      estimateAccuracy: {
        tasksWithEstimate: withEstimate.length,
        totalEstimateMinutes: totalEstimate,
      },
      tagDistribution: tagDist,
    };

    log.info("getStats", {
      total,
      done: done.length,
      completionRate,
      stale: staleTasks.length,
    });

    return stats;
  }

  private analyzeCommits(
    commits: Array<{ sha: string; message: string; date: string }>
  ): {
    mostActiveHour: string | null;
    mostActiveDay: string | null;
    avgTasksPerDay: number;
  } {
    if (commits.length === 0) {
      return { mostActiveHour: null, mostActiveDay: null, avgTasksPerDay: 0 };
    }

    const byHour: Record<number, number> = {};
    const byDay: Record<string, number> = {};
    const uniqueDays = new Set<string>();

    // Only count commits that are task-related
    const taskCommits = commits.filter((c) =>
      /task|mark.*done|add.*task/i.test(c.message)
    );

    for (const c of commits) {
      if (!c.date) continue;
      const d = new Date(c.date);
      if (isNaN(d.getTime())) continue;

      byHour[d.getHours()] = (byHour[d.getHours()] ?? 0) + 1;
      const dayName = DAY_NAMES[d.getDay()];
      byDay[dayName] = (byDay[dayName] ?? 0) + 1;
      uniqueDays.add(d.toISOString().split("T")[0]);
    }

    // Most active hour
    let mostActiveHour: string | null = null;
    let maxHour = 0;
    for (const [h, count] of Object.entries(byHour)) {
      if (count > maxHour) {
        maxHour = count;
        const hour = Number(h);
        mostActiveHour = `${hour.toString().padStart(2, "0")}:00`;
      }
    }

    // Most active day
    let mostActiveDay: string | null = null;
    let maxDay = 0;
    for (const [day, count] of Object.entries(byDay)) {
      if (count > maxDay) {
        maxDay = count;
        mostActiveDay = day;
      }
    }

    // Avg tasks per day = task-related commits / unique active days
    const activeDays = uniqueDays.size || 1;
    const avgTasksPerDay =
      Math.round((taskCommits.length / activeDays) * 10) / 10;

    return { mostActiveHour, mostActiveDay, avgTasksPerDay };
  }

  private findStaleTasks(
    openTasks: Task[]
  ): Array<{ id: string; text: string; source: string; reason: string }> {
    const todayStr = new Date().toISOString().split("T")[0];
    const stale: Array<{
      id: string;
      text: string;
      source: string;
      reason: string;
    }> = [];

    for (const t of openTasks) {
      // Overdue by 7+ days
      if (t.dueDate && t.dueDate < todayStr) {
        const due = new Date(t.dueDate);
        const days = Math.floor(
          (Date.now() - due.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (days >= 7) {
          stale.push({
            id: t.id,
            text: t.text,
            source: t.source,
            reason: `overdue by ${days} days`,
          });
          continue;
        }
      }

      // In backlog with no priority and no due date — likely forgotten
      if (
        t.source.includes("backlog") &&
        !t.priority &&
        !t.dueDate
      ) {
        stale.push({
          id: t.id,
          text: t.text,
          source: t.source,
          reason: "backlog item with no priority or deadline",
        });
      }
    }

    return stale;
  }
}
