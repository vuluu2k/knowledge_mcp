import type { Brain } from "./brain.js";
import type { GitHubClient } from "../github/client.js";
import type { Task } from "../types/task.js";
import type { Goal, InboxItem } from "../types/brain.js";
import { getLogger } from "../logger.js";

// ─── Types ─────────────────────────────────────────────────

export type InsightCategory =
  | "productivity"
  | "procrastination"
  | "task-structure"
  | "goal-alignment"
  | "workload";

export type InsightSeverity = "low" | "medium" | "high";

export interface BehaviorInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  signal: string;
  evidence: string;
  suggestion: string;
}

export interface ProductivityPattern {
  chronotype: "early-bird" | "night-owl" | "balanced" | "unknown";
  peakHours: number[];
  peakDays: string[];
  consistencyScore: number;
  weekendWorker: boolean;
  trendDirection: "improving" | "declining" | "stable" | "unknown";
}

export interface WorkloadPattern {
  todayLoadMinutes: number;
  backlogRatio: number;
  topTags: Array<{ tag: string; count: number }>;
  estimateCoverage: number;
}

export interface BehaviorReport {
  generatedAt: string;
  healthScore: number;
  insights: BehaviorInsight[];
  patterns: {
    productivity: ProductivityPattern;
    workload: WorkloadPattern;
  };
}

// ─── Constants ─────────────────────────────────────────────

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ─── Internal data bundle ──────────────────────────────────

interface AnalysisData {
  todayTasks: Task[];
  backlogTasks: Task[];
  allTasks: Task[];
  openTasks: Task[];
  doneTasks: Task[];
  goals: string[];
  inbox: InboxItem[];
  commits: Array<{ sha: string; message: string; date: string }>;
  todayStr: string;
}

// ─── BehaviorEngine ────────────────────────────────────────

export class BehaviorEngine {
  constructor(
    private brain: Brain,
    private client: GitHubClient,
    private basePath: string
  ) {}

  async analyze(): Promise<BehaviorReport> {
    const log = getLogger();

    const [allTasks, shortGoals, longGoals, inbox, commits] =
      await Promise.all([
        this.brain.getAllTasks(),
        this.brain.getGoals("short-term").catch(() => [] as Goal[]),
        this.brain.getGoals("long-term").catch(() => [] as Goal[]),
        this.brain.getInbox().catch(() => [] as InboxItem[]),
        this.client.listCommits(this.basePath, 100).catch(() => []),
      ]);

    const combined = [...allTasks.today, ...allTasks.backlog];

    const data: AnalysisData = {
      todayTasks: allTasks.today,
      backlogTasks: allTasks.backlog,
      allTasks: combined,
      openTasks: combined.filter((t) => t.status === "todo"),
      doneTasks: combined.filter((t) => t.status === "done"),
      goals: [
        ...shortGoals.map((g) => g.text),
        ...longGoals.map((g) => g.text),
      ],
      inbox,
      commits,
      todayStr: new Date().toISOString().split("T")[0],
    };

    // Run all detectors
    const insights: BehaviorInsight[] = [
      ...this.detectProductivityPatterns(data),
      ...this.detectProcrastination(data),
      ...this.detectTaskStructureIssues(data),
      ...this.detectGoalMisalignment(data),
      ...this.detectWorkloadIssues(data),
    ];

    // Sort: high > medium > low
    const order: Record<InsightSeverity, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    insights.sort((a, b) => order[a.severity] - order[b.severity]);

    const productivity = this.extractProductivityPattern(data);
    const workload = this.extractWorkloadPattern(data);
    const healthScore = this.computeHealthScore(data, insights);

    const report: BehaviorReport = {
      generatedAt: new Date().toISOString(),
      healthScore,
      insights,
      patterns: { productivity, workload },
    };

    log.info("analyzeBehavior", {
      healthScore,
      insightCount: insights.length,
      high: insights.filter((i) => i.severity === "high").length,
      medium: insights.filter((i) => i.severity === "medium").length,
    });

    return report;
  }

  // ─── Detector 1: Productivity Patterns ───────────────────

  private detectProductivityPatterns(data: AnalysisData): BehaviorInsight[] {
    const insights: BehaviorInsight[] = [];
    const { commits } = data;
    if (commits.length < 3) return insights;

    const parsed = this.parseCommitDates(commits);
    if (parsed.length === 0) return insights;

    // Chronotype detection
    const hourCounts = this.countByHour(parsed);
    const morningActivity = this.sumRange(hourCounts, 5, 11);
    const eveningActivity = this.sumRange(hourCounts, 18, 23);
    const total = parsed.length;

    if (morningActivity / total > 0.5) {
      insights.push({
        id: "prod-early-bird",
        category: "productivity",
        severity: "low",
        signal: "Early bird pattern detected",
        evidence: `${Math.round((morningActivity / total) * 100)}% of your activity happens between 5:00-11:00`,
        suggestion:
          "Schedule high-priority and creative tasks in the morning when you're most productive",
      });
    } else if (eveningActivity / total > 0.4) {
      insights.push({
        id: "prod-night-owl",
        category: "productivity",
        severity: "low",
        signal: "Night owl pattern detected",
        evidence: `${Math.round((eveningActivity / total) * 100)}% of your activity happens between 18:00-23:00`,
        suggestion:
          "Protect your evening focus time. Avoid scheduling meetings or shallow tasks during this window",
      });
    }

    // Weekend work detection
    const weekendCommits = parsed.filter((d) => d.getDay() === 0 || d.getDay() === 6).length;
    if (weekendCommits / total > 0.25) {
      insights.push({
        id: "prod-weekend-work",
        category: "productivity",
        severity: "medium",
        signal: "Significant weekend work detected",
        evidence: `${Math.round((weekendCommits / total) * 100)}% of activity happens on weekends (${weekendCommits} of ${total} actions)`,
        suggestion:
          "Consider whether weekend work is intentional. If not, review your weekday workload and set boundaries",
      });
    }

    // Activity trend: compare last 7 days vs previous 7 days
    const now = Date.now();
    const recentWeek = parsed.filter(
      (d) => now - d.getTime() < 7 * MS_PER_DAY
    ).length;
    const previousWeek = parsed.filter(
      (d) =>
        now - d.getTime() >= 7 * MS_PER_DAY &&
        now - d.getTime() < 14 * MS_PER_DAY
    ).length;

    if (previousWeek > 0) {
      const ratio = recentWeek / previousWeek;
      if (ratio < 0.5) {
        insights.push({
          id: "prod-declining",
          category: "productivity",
          severity: "medium",
          signal: "Activity declining",
          evidence: `${recentWeek} actions this week vs ${previousWeek} last week (${Math.round(ratio * 100)}%)`,
          suggestion:
            "Activity dropped significantly. Check if you're blocked, overloaded, or need to reprioritize",
        });
      } else if (ratio > 1.5) {
        insights.push({
          id: "prod-improving",
          category: "productivity",
          severity: "low",
          signal: "Activity increasing",
          evidence: `${recentWeek} actions this week vs ${previousWeek} last week — ${Math.round((ratio - 1) * 100)}% increase`,
          suggestion: "Great momentum. Make sure the pace is sustainable and you're not just adding tasks without finishing them",
        });
      }
    }

    // Inactivity detection
    if (recentWeek === 0 && commits.length > 5) {
      insights.push({
        id: "prod-inactive",
        category: "productivity",
        severity: "high",
        signal: "No activity in the past 7 days",
        evidence: `Last activity was ${commits[0]?.date ? new Date(commits[0].date).toISOString().split("T")[0] : "unknown"}. Total history: ${commits.length} actions`,
        suggestion:
          "You've gone quiet. Open your task list and pick one small task to restart momentum",
      });
    }

    return insights;
  }

  // ─── Detector 2: Procrastination ─────────────────────────

  private detectProcrastination(data: AnalysisData): BehaviorInsight[] {
    const insights: BehaviorInsight[] = [];
    const { openTasks, doneTasks, todayStr } = data;

    // Priority inversion: high-pri open while low-pri done
    const highPriOpen = openTasks.filter((t) => t.priority === "high");
    const lowPriDone = doneTasks.filter(
      (t) => t.priority === "low" || !t.priority
    );

    if (highPriOpen.length > 0 && lowPriDone.length > 0) {
      const topNames = highPriOpen
        .slice(0, 3)
        .map((t) => `"${t.text}"`)
        .join(", ");
      insights.push({
        id: "proc-priority-inversion",
        category: "procrastination",
        severity: "high",
        signal: "Priority inversion detected",
        evidence: `${highPriOpen.length} high-priority task(s) still pending (${topNames}) while ${lowPriDone.length} low/no-priority task(s) were completed`,
        suggestion: `Tackle the high-priority items first. Start with: "${highPriOpen[0].text}"`,
      });
    }

    // Overdue accumulation
    const overdue = openTasks.filter(
      (t) => t.dueDate !== undefined && t.dueDate < todayStr
    );
    if (overdue.length > 0) {
      const worstOverdue = overdue.reduce((worst, t) => {
        const days = Math.floor(
          (Date.now() - new Date(t.dueDate!).getTime()) / MS_PER_DAY
        );
        return days > (worst.days ?? 0) ? { task: t, days } : worst;
      }, {} as { task?: Task; days?: number });

      const severity: InsightSeverity =
        overdue.length >= 5 ? "high" : overdue.length >= 2 ? "medium" : "low";

      insights.push({
        id: "proc-overdue-accumulation",
        category: "procrastination",
        severity,
        signal: `${overdue.length} overdue task(s)`,
        evidence: `Worst: "${worstOverdue.task?.text}" is ${worstOverdue.days} day(s) overdue. Tasks: ${overdue.map((t) => `"${t.text}"`).join(", ")}`,
        suggestion:
          overdue.length >= 3
            ? "Too many overdue items. Block 30 minutes now to triage: finish, reschedule, or drop each one"
            : `Finish or reschedule "${worstOverdue.task?.text}" today`,
      });
    }

    // Estimate avoidance: most open tasks have no estimate
    const openWithoutEstimate = openTasks.filter((t) => !t.estimate);
    if (openTasks.length >= 3 && openWithoutEstimate.length / openTasks.length > 0.7) {
      insights.push({
        id: "proc-estimate-avoidance",
        category: "procrastination",
        severity: "medium",
        signal: "Most tasks have no time estimate",
        evidence: `${openWithoutEstimate.length} of ${openTasks.length} open tasks (${Math.round((openWithoutEstimate.length / openTasks.length) * 100)}%) lack an estimate`,
        suggestion:
          "Tasks without estimates are easier to postpone. Add @est(Xh) to your top 3 tasks — estimating forces you to commit",
      });
    }

    return insights;
  }

  // ─── Detector 3: Task Structure Issues ───────────────────

  private detectTaskStructureIssues(data: AnalysisData): BehaviorInsight[] {
    const insights: BehaviorInsight[] = [];
    const { openTasks } = data;
    if (openTasks.length === 0) return insights;

    // Vague tasks (≤3 words)
    const vague = openTasks.filter((t) => t.text.split(/\s+/).length <= 3);
    if (vague.length > 0) {
      const examples = vague
        .slice(0, 3)
        .map((t) => `"${t.text}"`)
        .join(", ");
      insights.push({
        id: "struct-vague-tasks",
        category: "task-structure",
        severity: vague.length >= 3 ? "medium" : "low",
        signal: `${vague.length} vague task(s) detected`,
        evidence: `Tasks with 3 or fewer words: ${examples}`,
        suggestion:
          "Rewrite vague tasks with a clear action and outcome. E.g., 'Fix bug' → 'Fix login timeout bug in auth module'",
      });
    }

    // Oversized tasks (estimate > 4h)
    const oversized = openTasks.filter(
      (t) => t.estimate !== undefined && t.estimate > 240
    );
    if (oversized.length > 0) {
      const examples = oversized
        .map((t) => `"${t.text}" (${Math.round(t.estimate! / 60)}h)`)
        .join(", ");
      insights.push({
        id: "struct-oversized-tasks",
        category: "task-structure",
        severity: "medium",
        signal: `${oversized.length} oversized task(s) detected`,
        evidence: `Tasks estimated over 4 hours: ${examples}`,
        suggestion:
          "Break tasks over 4h into smaller subtasks. Large tasks are harder to start and easier to postpone",
      });
    }

    // Missing priority on open tasks
    const noPriority = openTasks.filter((t) => !t.priority);
    if (
      openTasks.length >= 3 &&
      noPriority.length / openTasks.length > 0.6
    ) {
      insights.push({
        id: "struct-no-priority",
        category: "task-structure",
        severity: "medium",
        signal: "Most tasks lack priority",
        evidence: `${noPriority.length} of ${openTasks.length} open tasks have no priority set`,
        suggestion:
          "Without priorities, everything feels equally urgent. Add ! (low), !! (medium), or !!! (high) to each task",
      });
    }

    // No tags at all
    const noTags = openTasks.filter((t) => t.tags.length === 0);
    if (openTasks.length >= 3 && noTags.length / openTasks.length > 0.6) {
      insights.push({
        id: "struct-no-tags",
        category: "task-structure",
        severity: "low",
        signal: "Most tasks are uncategorized",
        evidence: `${noTags.length} of ${openTasks.length} open tasks have no tags`,
        suggestion:
          "Tags help track where your time goes (e.g., #dev, #admin, #learning). Add at least one tag per task",
      });
    }

    return insights;
  }

  // ─── Detector 4: Goal Alignment ──────────────────────────

  private detectGoalMisalignment(data: AnalysisData): BehaviorInsight[] {
    const insights: BehaviorInsight[] = [];
    const { openTasks, goals } = data;
    if (goals.length === 0 || openTasks.length === 0) return insights;

    // Extract keywords from goals (words > 2 chars)
    const goalKeywords = new Set<string>();
    for (const goal of goals) {
      for (const word of goal.toLowerCase().split(/\s+/)) {
        if (word.length > 2) goalKeywords.add(word);
      }
    }

    if (goalKeywords.size === 0) return insights;

    // Check each open task for keyword overlap with goals
    let alignedCount = 0;
    const unaligned: Task[] = [];

    for (const task of openTasks) {
      const taskWords = [
        ...task.text.toLowerCase().split(/\s+/),
        ...task.tags.map((t) => t.toLowerCase()),
      ];
      const hasOverlap = taskWords.some((w) => goalKeywords.has(w));
      if (hasOverlap) {
        alignedCount++;
      } else {
        unaligned.push(task);
      }
    }

    const alignmentRate = alignedCount / openTasks.length;

    if (alignmentRate < 0.3 && openTasks.length >= 3) {
      const unalignedExamples = unaligned
        .slice(0, 3)
        .map((t) => `"${t.text}"`)
        .join(", ");
      const goalExamples = goals.slice(0, 2).map((g) => `"${g}"`).join(", ");
      insights.push({
        id: "goal-low-alignment",
        category: "goal-alignment",
        severity: "high",
        signal: "Tasks poorly aligned with goals",
        evidence: `Only ${Math.round(alignmentRate * 100)}% of open tasks relate to your goals (${goalExamples}). Unrelated: ${unalignedExamples}`,
        suggestion:
          "Review your task list against your goals. Either update goals to reflect actual work, or reprioritize tasks toward stated goals",
      });
    } else if (alignmentRate < 0.5 && openTasks.length >= 3) {
      insights.push({
        id: "goal-moderate-alignment",
        category: "goal-alignment",
        severity: "medium",
        signal: "Moderate goal alignment",
        evidence: `${Math.round(alignmentRate * 100)}% of open tasks relate to your goals. ${unaligned.length} task(s) appear unrelated`,
        suggestion:
          "About half your work drifts from stated goals. Check if unrelated tasks can be delegated or moved to backlog",
      });
    }

    return insights;
  }

  // ─── Detector 5: Workload Issues ─────────────────────────

  private detectWorkloadIssues(data: AnalysisData): BehaviorInsight[] {
    const insights: BehaviorInsight[] = [];
    const { openTasks, todayTasks, backlogTasks, inbox } = data;

    // Overcommitment: today's open task estimates > 8h
    const todayOpen = todayTasks.filter((t) => t.status === "todo");
    const todayEstimate = todayOpen.reduce(
      (sum, t) => sum + (t.estimate ?? 0),
      0
    );
    if (todayEstimate > 480) {
      insights.push({
        id: "work-overcommit",
        category: "workload",
        severity: "high",
        signal: "Overcommitted today",
        evidence: `Today's open tasks total ${Math.round(todayEstimate / 60)}h estimated work (${todayOpen.length} tasks). A realistic day is ~6-8h of focused work`,
        suggestion:
          "Move lower-priority tasks to backlog. Pick 3-5 tasks that fit within 6 hours",
      });
    } else if (todayEstimate > 360 && todayEstimate <= 480) {
      insights.push({
        id: "work-full-day",
        category: "workload",
        severity: "low",
        signal: "Full day planned",
        evidence: `Today's tasks total ${Math.round(todayEstimate / 60)}h. That's a full day with no buffer`,
        suggestion:
          "Leave 1-2h of buffer for unexpected work. Consider moving one task to tomorrow",
      });
    }

    // Inbox overflow
    if (inbox.length > 10) {
      insights.push({
        id: "work-inbox-overflow",
        category: "workload",
        severity: "medium",
        signal: "Inbox overflowing",
        evidence: `${inbox.length} unprocessed items in inbox`,
        suggestion:
          "Spend 10 minutes processing your inbox: convert items to tasks, notes, or knowledge — then delete them",
      });
    } else if (inbox.length > 5) {
      insights.push({
        id: "work-inbox-growing",
        category: "workload",
        severity: "low",
        signal: "Inbox needs attention",
        evidence: `${inbox.length} unprocessed items in inbox`,
        suggestion:
          "Process your inbox before it piles up. Aim to keep it under 5 items",
      });
    }

    // Backlog bloat: backlog open > 2x today open
    const backlogOpen = backlogTasks.filter((t) => t.status === "todo").length;
    if (backlogOpen > 15) {
      insights.push({
        id: "work-backlog-bloat",
        category: "workload",
        severity: "medium",
        signal: "Backlog is bloated",
        evidence: `${backlogOpen} open items in backlog. Large backlogs create decision fatigue and hide important work`,
        suggestion:
          "Review your backlog: delete tasks you'll never do, merge duplicates, and promote urgent items to today",
      });
    }

    // Zero tasks with estimates
    const estimatedCount = openTasks.filter((t) => t.estimate).length;
    if (openTasks.length >= 5 && estimatedCount === 0) {
      insights.push({
        id: "work-no-estimates",
        category: "workload",
        severity: "medium",
        signal: "No tasks have time estimates",
        evidence: `0 of ${openTasks.length} open tasks have estimates. Impossible to gauge workload`,
        suggestion:
          "Add @est(Xh) to at least your today tasks. Estimates help detect overcommitment before it happens",
      });
    }

    return insights;
  }

  // ─── Pattern Extraction ──────────────────────────────────

  private extractProductivityPattern(data: AnalysisData): ProductivityPattern {
    const parsed = this.parseCommitDates(data.commits);
    if (parsed.length < 3) {
      return {
        chronotype: "unknown",
        peakHours: [],
        peakDays: [],
        consistencyScore: 0,
        weekendWorker: false,
        trendDirection: "unknown",
      };
    }

    const hourCounts = this.countByHour(parsed);
    const dayCounts = this.countByDay(parsed);
    const total = parsed.length;

    // Chronotype
    const morning = this.sumRange(hourCounts, 5, 11);
    const evening = this.sumRange(hourCounts, 18, 23);
    let chronotype: ProductivityPattern["chronotype"] = "balanced";
    if (morning / total > 0.5) chronotype = "early-bird";
    else if (evening / total > 0.4) chronotype = "night-owl";

    // Peak hours (top 3)
    const peakHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([h]) => Number(h));

    // Peak days (above average)
    const avgPerDay = total / Math.max(Object.keys(dayCounts).length, 1);
    const peakDays = Object.entries(dayCounts)
      .filter(([, count]) => count > avgPerDay)
      .sort(([, a], [, b]) => b - a)
      .map(([day]) => day);

    // Consistency: count unique active days in last 14 days
    const now = Date.now();
    const twoWeeks = 14 * MS_PER_DAY;
    const recentDays = new Set(
      parsed
        .filter((d) => now - d.getTime() < twoWeeks)
        .map((d) => d.toISOString().split("T")[0])
    );
    const consistencyScore = Math.round((recentDays.size / 14) * 100);

    // Weekend worker
    const weekendCommits = parsed.filter(
      (d) => d.getDay() === 0 || d.getDay() === 6
    ).length;
    const weekendWorker = weekendCommits / total > 0.2;

    // Trend
    const recentWeek = parsed.filter(
      (d) => now - d.getTime() < 7 * MS_PER_DAY
    ).length;
    const prevWeek = parsed.filter(
      (d) =>
        now - d.getTime() >= 7 * MS_PER_DAY &&
        now - d.getTime() < 14 * MS_PER_DAY
    ).length;
    let trendDirection: ProductivityPattern["trendDirection"] = "stable";
    if (prevWeek > 0) {
      const ratio = recentWeek / prevWeek;
      if (ratio > 1.3) trendDirection = "improving";
      else if (ratio < 0.7) trendDirection = "declining";
    } else {
      trendDirection = recentWeek > 0 ? "stable" : "unknown";
    }

    return {
      chronotype,
      peakHours,
      peakDays,
      consistencyScore,
      weekendWorker,
      trendDirection,
    };
  }

  private extractWorkloadPattern(data: AnalysisData): WorkloadPattern {
    const { openTasks, todayTasks, backlogTasks, allTasks } = data;

    const todayOpen = todayTasks.filter((t) => t.status === "todo");
    const todayLoadMinutes = todayOpen.reduce(
      (sum, t) => sum + (t.estimate ?? 0),
      0
    );

    const totalOpen = openTasks.length || 1;
    const backlogOpen = backlogTasks.filter((t) => t.status === "todo").length;
    const backlogRatio = Math.round((backlogOpen / totalOpen) * 100);

    // Tag distribution — top 5
    const tagCounts: Record<string, number> = {};
    for (const t of allTasks) {
      for (const tag of t.tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    // Estimate coverage
    const withEstimate = openTasks.filter((t) => t.estimate).length;
    const estimateCoverage =
      openTasks.length > 0
        ? Math.round((withEstimate / openTasks.length) * 100)
        : 0;

    return { todayLoadMinutes, backlogRatio, topTags, estimateCoverage };
  }

  // ─── Health Score ────────────────────────────────────────

  private computeHealthScore(
    data: AnalysisData,
    insights: BehaviorInsight[]
  ): number {
    let score = 100;
    const { allTasks, openTasks, doneTasks } = data;

    // Completion rate impact (-0 to -20)
    if (allTasks.length > 0) {
      const rate = doneTasks.length / allTasks.length;
      if (rate < 0.3) score -= 20;
      else if (rate < 0.5) score -= 15;
      else if (rate < 0.7) score -= 10;
      else if (rate < 0.85) score -= 5;
    }

    // Deduct for detected issues
    for (const insight of insights) {
      switch (insight.severity) {
        case "high":
          score -= 8;
          break;
        case "medium":
          score -= 4;
          break;
        case "low":
          score -= 1;
          break;
      }
    }

    // Bonus: all tasks have estimates (+5)
    if (
      openTasks.length > 0 &&
      openTasks.every((t) => t.estimate !== undefined)
    ) {
      score += 5;
    }

    // Bonus: all tasks have priority (+5)
    if (
      openTasks.length > 0 &&
      openTasks.every((t) => t.priority !== undefined)
    ) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  // ─── Helpers ─────────────────────────────────────────────

  private parseCommitDates(
    commits: Array<{ date: string }>
  ): Date[] {
    return commits
      .map((c) => new Date(c.date))
      .filter((d) => !isNaN(d.getTime()));
  }

  private countByHour(dates: Date[]): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const d of dates) {
      const h = d.getHours();
      counts[h] = (counts[h] ?? 0) + 1;
    }
    return counts;
  }

  private countByDay(dates: Date[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const d of dates) {
      const day = DAY_NAMES[d.getDay()];
      counts[day] = (counts[day] ?? 0) + 1;
    }
    return counts;
  }

  private sumRange(
    counts: Record<number, number>,
    from: number,
    to: number
  ): number {
    let sum = 0;
    for (let h = from; h <= to; h++) {
      sum += counts[h] ?? 0;
    }
    return sum;
  }
}
