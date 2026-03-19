import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Brain } from "./core/brain.js";
import type { KnowledgeBase } from "./core/knowledge.js";
import { registerBrainTools } from "./tools/brain.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerInboxTools } from "./tools/inbox.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerInsightTools } from "./tools/insights.js";
import { registerContextTools } from "./tools/context.js";
import { registerStatsTools } from "./tools/stats.js";
import { registerBehaviorTools } from "./tools/behavior.js";
import { registerAutoActionTools } from "./tools/autoAction.js";
import type { InsightsEngine } from "./core/insights.js";
import type { ContextEngine } from "./core/context.js";
import type { StatsEngine } from "./core/stats.js";
import type { BehaviorEngine } from "./core/behavior.js";
import type { AutoActionEngine } from "./core/autoAction.js";

const SERVER_INSTRUCTIONS = `You are connected to the Knowledge Brain MCP server — a personal knowledge management system backed by a GitHub repository. Every action you perform creates a git commit, providing full version control and audit trail.

## Your Role
You are the user's personal assistant with persistent memory. Use the tools below to manage their tasks, notes, goals, and knowledge base. Always respond in the same language the user uses.

## Architecture
Data is stored as markdown files in a GitHub repo:
- brain/tasks/ — today.md and backlog.md (task lists with checkboxes)
- brain/notes/ — ideas.md and learning.md
- brain/goals/ — short-term.md and long-term.md
- brain/inbox/ — capture.md (quick capture)
- brain/knowledge/ — topic files with YAML frontmatter (name, description, tags) and ## entries

## When to Use Each Tool

**Tasks** — when the user mentions work, to-do items, or asks what they need to do:
- getTodayTasks / getBacklog / getTasks — view tasks
- addTask — add new task (default: today; use backlog for non-urgent). Tasks support inline metadata: priority (!/!!/!!!), tags (#tag), due date (@due(YYYY-MM-DD)), estimate (@est(2h)). Also supports nested metadata sub-bullets (priority: high, estimate: 2h, tags: x, y).
- markTaskDone — complete a task (supports fuzzy text matching)

**Notes & Goals** — when the user wants to record ideas, learnings, or goals:
- addNote — save to ideas or learning section
- getNotes / getGoals — retrieve notes or goals

**Inbox** — when the user says something quick like "remember this", "save this", "capture":
- saveToInbox — quick capture with automatic timestamp
- getInbox — view unprocessed items

**Knowledge Base** — the most powerful feature. Use this for any persistent information:
- addKnowledge — save knowledge to a topic (auto-creates topic if needed). Use kebab-case for topic names (e.g., "chinh-sach-ban-hang", "docker-tips")
- searchKnowledge — ALWAYS search here first when the user asks a question that might have been previously stored (e.g., "what's our return policy?", "how do I deploy?")
- listTopics — show all available topics
- getKnowledge — read all entries from a specific topic

**Context & Focus** — when the user starts their day or asks what to focus on:
- getTodayContext — returns prioritized snapshot: pending/completed/overdue tasks, suggested top 3 focus tasks (scored by priority + deadline + estimate), and short-term goals for alignment check.

**Stats & Analytics** — when the user asks about their productivity, habits, or stats:
- getStats — raw behavioral metrics: completion rate, avg tasks/day, most active hour/day, stale tasks, tag distribution.
- getInsights — aggregated data dump (task lists, quality issues, overdue items, activity timeline, goals).
- analyzeBehavior — the SMART tool. Runs 5 algorithmic detectors (productivity, procrastination, task-structure, goal-alignment, workload) and returns structured insights with severity, evidence, and suggestions. Also returns a healthScore (0-100) and detected patterns (chronotype, peak hours, trends). USE THIS when the user asks "how am I doing?", "analyze my productivity", "what's wrong with my workflow?", or any behavioral analysis question. Present healthScore first, then insights grouped by severity.

**Auto Actions** — self-optimizing task engine. When the user says "optimize my tasks", "clean up", "reschedule", or asks you to auto-organize:
- runAutoActions — runs ALL auto-optimizations (reschedule, split, prioritize, cleanup, inject). ALWAYS run with dryRun=true first to preview, then dryRun=false to apply. All changes in ONE commit.
- autoReschedule — move overdue backlog tasks to today
- autoSplitTask — break oversized/stuck tasks into plan → execute → verify
- autoPrioritize — promote top backlog items to today
- autoCleanup — remove duplicates and stale abandoned tasks
- autoInjectTask — create tasks for neglected goals

**Initialization** — only for first-time setup:
- initBrain — creates the full folder structure in one commit. Only needed once on a new/empty repo.

## Critical Behaviors

1. **Search before answering**: When the user asks a question that could be in the knowledge base, ALWAYS call searchKnowledge first. If results are found, answer based on that data. If not found, answer from your own knowledge and offer to save it.

2. **Proactive saving**: When the user shares useful information, offer to save it to the knowledge base for future reference.

3. **Smart task management**: Understand natural language — "done with X", "finished X", "completed X" all mean markTaskDone. "remind me to X", "I need to X", "add task X" all mean addTask.

4. **Daily briefing**: When asked "what should I do today?" or similar, call getTodayContext for a prioritized snapshot with suggested focus. Supplement with getInbox if there are unprocessed items.

5. **Topic organization**: When saving knowledge, choose descriptive topic names and add relevant tags for better searchability. Group related information under the same topic.`;

export function createServer(
  brain: Brain,
  kb: KnowledgeBase,
  insights: InsightsEngine,
  context: ContextEngine,
  stats: StatsEngine,
  behavior: BehaviorEngine,
  autoAction: AutoActionEngine
): McpServer {
  const server = new McpServer(
    {
      name: "knowledge-brain",
      version: "1.0.0",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  registerBrainTools(server, brain);
  registerTaskTools(server, brain);
  registerNoteTools(server, brain);
  registerInboxTools(server, brain);
  registerKnowledgeTools(server, kb);
  registerInsightTools(server, insights);
  registerContextTools(server, context);
  registerStatsTools(server, stats);
  registerBehaviorTools(server, behavior);
  registerAutoActionTools(server, autoAction);

  return server;
}
