import type { Brain } from "./brain.js";
import type { Task } from "../types/task.js";
import type { Goal } from "../types/brain.js";
import { getLogger } from "../logger.js";

// ─── Types ─────────────────────────────────────────────────

export interface TodayContext {
  pendingTasks: Task[];
  completedTasks: Task[];
  highPriorityTasks: Task[];
  overdueTasks: Task[];
  suggestedFocus: Task[];
  goals: string[];
  summary: {
    pending: number;
    completed: number;
    highPriority: number;
    overdue: number;
    totalEstimateMinutes: number;
  };
}

// ─── Focus scoring ─────────────────────────────────────────

function scoreTask(task: Task, todayStr: string): number {
  let score = 0;

  // Priority weight
  if (task.priority === "high") score += 30;
  else if (task.priority === "medium") score += 20;
  else if (task.priority === "low") score += 10;

  // Due date proximity
  if (task.dueDate) {
    score += 15;
    if (task.dueDate <= todayStr) score += 25; // overdue = urgent
    else {
      // Due within 2 days
      const due = new Date(task.dueDate).getTime();
      const today = new Date(todayStr).getTime();
      const twoDays = 2 * 24 * 60 * 60 * 1000;
      if (due - today <= twoDays) score += 10;
    }
  }

  // Prefer tasks with estimates (well-defined work)
  if (task.estimate) {
    score += 5;
    // Quick wins get a small boost
    if (task.estimate <= 30) score += 5;
  }

  return score;
}

// ─── ContextEngine ─────────────────────────────────────────

export class ContextEngine {
  constructor(private brain: Brain) {}

  async getTodayContext(): Promise<TodayContext> {
    const log = getLogger();
    const todayStr = new Date().toISOString().split("T")[0];

    const [allTasks, shortGoals] = await Promise.all([
      this.brain.getAllTasks(),
      this.brain.getGoals("short-term").catch(() => [] as Goal[]),
    ]);

    const combined = [...allTasks.today, ...allTasks.backlog];
    const pending = combined.filter((t) => t.status === "todo");
    const completed = combined.filter((t) => t.status === "done");

    const highPriority = pending.filter((t) => t.priority === "high");

    const overdue = pending.filter(
      (t) => t.dueDate !== undefined && t.dueDate < todayStr
    );

    // Suggested focus: top 3 pending tasks by score
    const scored = pending
      .map((t) => ({ task: t, score: scoreTask(t, todayStr) }))
      .sort((a, b) => b.score - a.score);
    const suggestedFocus = scored.slice(0, 3).map((s) => s.task);

    const totalEstimate = pending.reduce(
      (sum, t) => sum + (t.estimate ?? 0),
      0
    );

    const ctx: TodayContext = {
      pendingTasks: pending,
      completedTasks: completed,
      highPriorityTasks: highPriority,
      overdueTasks: overdue,
      suggestedFocus,
      goals: shortGoals.map((g) => g.text),
      summary: {
        pending: pending.length,
        completed: completed.length,
        highPriority: highPriority.length,
        overdue: overdue.length,
        totalEstimateMinutes: totalEstimate,
      },
    };

    log.info("getTodayContext", {
      pending: pending.length,
      completed: completed.length,
      focus: suggestedFocus.map((t) => t.text),
    });

    return ctx;
  }
}
