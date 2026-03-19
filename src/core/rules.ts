import type { Task } from "../types/task.js";
import type { ActionType, PlannedAction } from "../types/action.js";

// ─── Rule Context ──────────────────────────────────────────

export interface RuleContext {
  todayTasks: Task[];
  backlogTasks: Task[];
  openToday: Task[];
  openBacklog: Task[];
  goals: string[];
  todayStr: string;
  /** IDs already claimed by a previous rule — skip these. */
  claimed: Set<string>;
}

/** Mutations that rules produce — collected and applied by the engine. */
export interface RuleMutations {
  todayRemoveIds: string[];
  backlogRemoveIds: string[];
  todayAppendLines: string[];
  /** Replacements: taskId → new lines (for split). */
  todayReplace: Array<{ taskId: string; newLines: string[] }>;
  backlogReplace: Array<{ taskId: string; newLines: string[] }>;
}

export interface RuleResult {
  actions: PlannedAction[];
  mutations: RuleMutations;
}

function emptyMutations(): RuleMutations {
  return {
    todayRemoveIds: [],
    backlogRemoveIds: [],
    todayAppendLines: [],
    todayReplace: [],
    backlogReplace: [],
  };
}

function claim(ctx: RuleContext, ids: string[]) {
  for (const id of ids) ctx.claimed.add(id);
}

// ─── Rule: autoReschedule ──────────────────────────────────
// Overdue backlog tasks → move to today

export function ruleAutoReschedule(ctx: RuleContext): RuleResult {
  const mut = emptyMutations();
  const actions: PlannedAction[] = [];

  const overdue = ctx.openBacklog.filter(
    (t) => !ctx.claimed.has(t.id) && t.dueDate !== undefined && t.dueDate < ctx.todayStr
  );

  if (overdue.length === 0) return { actions, mutations: mut };

  const ids = overdue.map((t) => t.id);
  claim(ctx, ids);

  mut.backlogRemoveIds.push(...ids);
  for (const t of overdue) {
    mut.todayAppendLines.push(t.rawLine);
  }

  actions.push({
    type: "autoReschedule",
    reason: `${overdue.length} overdue task(s) in backlog`,
    impact: "Moved overdue tasks to today for immediate attention",
    details: overdue.map(
      (t) => `Move "${t.text}" (due ${t.dueDate}) → today`
    ),
  });

  return { actions, mutations: mut };
}

// ─── Rule: autoSplitTask ───────────────────────────────────
// Tasks with estimate > 4h OR overdue > 7 days → split into plan/execute/verify

export function ruleAutoSplitTask(
  ctx: RuleContext,
  targetTaskId?: string
): RuleResult {
  const mut = emptyMutations();
  const actions: PlannedAction[] = [];

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const allOpen = [...ctx.openToday, ...ctx.openBacklog];

  const candidates = allOpen.filter((t) => {
    if (ctx.claimed.has(t.id)) return false;
    if (targetTaskId) return t.id === targetTaskId;

    // Estimate > 4h
    if (t.estimate !== undefined && t.estimate > 240) return true;

    // Overdue > 7 days
    if (t.dueDate && t.dueDate < ctx.todayStr) {
      const days = Math.floor(
        (now - new Date(t.dueDate).getTime()) / MS_PER_DAY
      );
      if (days > 7) return true;
    }

    return false;
  });

  // Limit to 3 splits per run to keep changes manageable
  const toSplit = candidates.slice(0, 3);

  for (const task of toSplit) {
    claim(ctx, [task.id]);

    const totalEst = task.estimate ?? 120; // default 2h if unknown
    const planEst = Math.min(30, Math.round(totalEst * 0.15));
    const verifyEst = Math.min(30, Math.round(totalEst * 0.15));
    const executeEst = Math.max(30, totalEst - planEst - verifyEst);

    const tags = task.tags.length > 0 ? ` #${task.tags.join(" #")}` : "";
    const due = task.dueDate ? ` @due(${task.dueDate})` : "";

    const subtasks = [
      `- [ ] ! Plan: ${task.text}${tags} @est(${formatEstimate(planEst)})`,
      `- [ ] ${task.priority === "high" ? "!!! " : "!! "}Execute: ${task.text}${tags}${due} @est(${formatEstimate(executeEst)})`,
      `- [ ] ! Verify: ${task.text}${tags} @est(${formatEstimate(verifyEst)})`,
    ];

    const isToday = task.source === "tasks/today";
    if (isToday) {
      mut.todayReplace.push({ taskId: task.id, newLines: subtasks });
    } else {
      mut.backlogReplace.push({ taskId: task.id, newLines: subtasks });
    }

    const reason =
      task.estimate !== undefined && task.estimate > 240
        ? `estimate ${formatEstimate(task.estimate)} exceeds 4h limit`
        : `overdue by more than 7 days`;

    actions.push({
      type: "autoSplitTask",
      reason: `"${task.text}" — ${reason}`,
      impact: "Split into plan → execute → verify phases",
      details: subtasks.map((s) => s.replace(/^- \[ \] /, "")),
    });
  }

  return { actions, mutations: mut };
}

// ─── Rule: autoPrioritize ──────────────────────────────────
// Backlog > 10 open AND today < 5 open → promote top 3

export function ruleAutoPrioritize(ctx: RuleContext): RuleResult {
  const mut = emptyMutations();
  const actions: PlannedAction[] = [];

  const unclaimed = ctx.openBacklog.filter((t) => !ctx.claimed.has(t.id));
  const todayOpen = ctx.openToday.filter((t) => !ctx.claimed.has(t.id));

  if (unclaimed.length <= 10 || todayOpen.length >= 5) {
    return { actions, mutations: mut };
  }

  // Score and pick top 3
  const scored = unclaimed
    .map((t) => ({ task: t, score: scoreForPromotion(t, ctx.todayStr) }))
    .sort((a, b) => b.score - a.score);

  const toPromote = scored.slice(0, 3).map((s) => s.task);
  const ids = toPromote.map((t) => t.id);
  claim(ctx, ids);

  mut.backlogRemoveIds.push(...ids);
  for (const t of toPromote) {
    mut.todayAppendLines.push(t.rawLine);
  }

  actions.push({
    type: "autoPrioritize",
    reason: `Backlog has ${unclaimed.length} open items, today only has ${todayOpen.length}`,
    impact: "Promoted top 3 backlog tasks to today based on priority and deadline",
    details: toPromote.map((t) => `Promote "${t.text}" → today`),
  });

  return { actions, mutations: mut };
}

// ─── Rule: autoCleanup ─────────────────────────────────────
// Remove duplicates + stale backlog tasks

export function ruleAutoCleanup(ctx: RuleContext): RuleResult {
  const mut = emptyMutations();
  const actions: PlannedAction[] = [];

  // 1. Duplicates: same text in both today and backlog → remove from backlog
  const todayTexts = new Set(
    ctx.todayTasks.map((t) => t.text.toLowerCase().trim())
  );
  const dupes = ctx.backlogTasks.filter(
    (t) =>
      !ctx.claimed.has(t.id) &&
      t.status === "todo" &&
      todayTexts.has(t.text.toLowerCase().trim())
  );

  if (dupes.length > 0) {
    const dupeIds = dupes.map((t) => t.id);
    claim(ctx, dupeIds);
    mut.backlogRemoveIds.push(...dupeIds);

    actions.push({
      type: "autoCleanup",
      reason: `${dupes.length} duplicate task(s) found in both today and backlog`,
      impact: "Removed backlog copies — today copies kept",
      details: dupes.map((t) => `Remove duplicate: "${t.text}" from backlog`),
    });
  }

  // 2. Stale: backlog + todo + no priority + no due date + no tags + vague (≤3 words)
  const stale = ctx.openBacklog.filter(
    (t) =>
      !ctx.claimed.has(t.id) &&
      !t.priority &&
      !t.dueDate &&
      t.tags.length === 0 &&
      t.text.split(/\s+/).length <= 3
  );

  if (stale.length > 0) {
    const staleIds = stale.map((t) => t.id);
    claim(ctx, staleIds);
    mut.backlogRemoveIds.push(...staleIds);

    actions.push({
      type: "autoCleanup",
      reason: `${stale.length} stale task(s) in backlog (no priority, no deadline, no tags, vague description)`,
      impact: "Removed abandoned tasks that were unlikely to be completed",
      details: stale.map((t) => `Remove stale: "${t.text}"`),
    });
  }

  return { actions, mutations: mut };
}

// ─── Rule: autoInjectTask ──────────────────────────────────
// Goals with no matching open tasks → inject a task

export function ruleAutoInjectTask(ctx: RuleContext): RuleResult {
  const mut = emptyMutations();
  const actions: PlannedAction[] = [];

  if (ctx.goals.length === 0) return { actions, mutations: mut };

  const allOpen = [...ctx.openToday, ...ctx.openBacklog].filter(
    (t) => !ctx.claimed.has(t.id)
  );

  // Build keyword set from all open tasks
  const taskWords = new Set<string>();
  for (const t of allOpen) {
    for (const w of t.text.toLowerCase().split(/\s+/)) {
      if (w.length > 2) taskWords.add(w);
    }
    for (const tag of t.tags) {
      taskWords.add(tag.toLowerCase());
    }
  }

  const neglectedGoals: string[] = [];

  for (const goal of ctx.goals) {
    const goalWords = goal
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const hasMatch = goalWords.some((w) => taskWords.has(w));
    if (!hasMatch) {
      neglectedGoals.push(goal);
    }
  }

  // Inject one task per neglected goal (max 2 per run)
  const toInject = neglectedGoals.slice(0, 2);

  for (const goal of toInject) {
    const line = `- [ ] !! Progress on goal: ${goal} @est(1h) #goals`;
    mut.todayAppendLines.push(line);
  }

  if (toInject.length > 0) {
    actions.push({
      type: "autoInjectTask",
      reason: `${toInject.length} goal(s) have no matching open tasks`,
      impact: "Injected tasks to maintain progress on neglected goals",
      details: toInject.map((g) => `Inject task for goal: "${g}"`),
    });
  }

  return { actions, mutations: mut };
}

// ─── Evaluate All Rules ────────────────────────────────────

export function evaluateAllRules(
  ctx: RuleContext,
  targetOnly?: ActionType,
  targetTaskId?: string
): { actions: PlannedAction[]; mutations: RuleMutations } {
  const allActions: PlannedAction[] = [];
  const merged = emptyMutations();

  const rules: Array<{
    type: ActionType;
    run: () => RuleResult;
  }> = [
    { type: "autoReschedule", run: () => ruleAutoReschedule(ctx) },
    { type: "autoSplitTask", run: () => ruleAutoSplitTask(ctx, targetTaskId) },
    { type: "autoPrioritize", run: () => ruleAutoPrioritize(ctx) },
    { type: "autoCleanup", run: () => ruleAutoCleanup(ctx) },
    { type: "autoInjectTask", run: () => ruleAutoInjectTask(ctx) },
  ];

  for (const rule of rules) {
    if (targetOnly && rule.type !== targetOnly) continue;

    const { actions, mutations } = rule.run();
    allActions.push(...actions);
    merged.todayRemoveIds.push(...mutations.todayRemoveIds);
    merged.backlogRemoveIds.push(...mutations.backlogRemoveIds);
    merged.todayAppendLines.push(...mutations.todayAppendLines);
    merged.todayReplace.push(...mutations.todayReplace);
    merged.backlogReplace.push(...mutations.backlogReplace);
  }

  return { actions: allActions, mutations: merged };
}

// ─── Helpers ───────────────────────────────────────────────

function formatEstimate(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

function scoreForPromotion(task: Task, todayStr: string): number {
  let score = 0;

  if (task.priority === "high") score += 30;
  else if (task.priority === "medium") score += 20;
  else if (task.priority === "low") score += 10;

  if (task.dueDate) {
    score += 15;
    if (task.dueDate <= todayStr) score += 25;
    else {
      const due = new Date(task.dueDate).getTime();
      const today = new Date(todayStr).getTime();
      if (due - today <= 2 * 24 * 60 * 60 * 1000) score += 10;
    }
  }

  if (task.estimate) {
    score += 5;
    if (task.estimate <= 60) score += 5;
  }

  return score;
}
