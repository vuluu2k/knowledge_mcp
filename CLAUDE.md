# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Knowledge MCP Server — a personal knowledge management system that gives AI persistent memory via GitHub. MCP protocol over stdio, all data stored as markdown files in a GitHub repo with atomic git commits.

## Build & Run Commands

```bash
npm run build    # TypeScript → ./dist (tsc)
npm start        # node dist/index.js
npm run dev      # tsx src/index.ts (hot reload)
```

No test suite exists. No linter configured.

## Architecture

**Data flow:** User → AI Platform → MCP Server (stdio) → Tool Handlers → Core Engines → BrainSync → GitHubClient (Octokit) → GitHub API → Markdown files in repo

**Key design principles:**
- ESM modules (`"type": "module"` in package.json, `"module": "Node16"` in tsconfig)
- Every write operation creates exactly one git commit
- SHA-based conflict detection with configurable retry (`WRITE_RETRIES`)
- stdout is reserved for MCP protocol — all logging goes to stderr via JSON logger
- Task IDs are deterministic: SHA256(source + text) first 8 chars
- Knowledge search ranks: tag match > title match > content match

### Layer Structure

1. **src/tools/*.ts** — MCP tool handlers. Each file exports a `registerXXXTools(server, ...)` function. Uses `toolHandler()` wrapper from `helpers.ts` for standardized error/response formatting. Input validation via Zod schemas.

2. **src/core/*.ts** — Business logic. Brain (tasks/notes/goals/inbox CRUD), KnowledgeBase (topic storage with YAML frontmatter), Parser (markdown ↔ structured data), and 5 analysis engines (Insights, Context, Stats, Behavior, AutoAction).

3. **src/github/*.ts** — GitHub integration. `client.ts` wraps Octokit with in-memory TTL cache. `sync.ts` provides `atomicUpdate(section, updateFn, commitMsg)` for safe read-modify-write cycles.

4. **src/types/*.ts** — Shared types: Task, BrainSection, FileContent, ActionType, etc.

### Adding a New Tool

1. Add core logic in `src/core/` if needed
2. Create `src/tools/newdomain.ts` exporting `registerNewDomainTools(server, ...)`
3. Register in `createServer()` in `src/mcp.ts`
4. Tool handler pattern: `server.tool(name, description, zodSchema, toolHandler(name, async (args) => { ... }))`

### Task Metadata Parsing (src/core/parser.ts)

Tasks support inline syntax (`!!!` priority, `#tag`, `@due(YYYY-MM-DD)`, `@est(2h)`) and nested sub-bullet metadata. Parser extracts and merges both formats. `removeTasksByIds()` and `replaceTaskWithLines()` enable auto-action mutations.

### Auto-Actions (src/core/rules.ts + autoAction.ts)

5 rules evaluated in sequence: reschedule → split → prioritize → cleanup → inject. Always preview with `dryRun=true` before applying. `evaluateAllRules()` returns planned actions + mutations that `AutoActionEngine.apply()` commits atomically.

### Behavior Analysis (src/core/behavior.ts)

5 deterministic detectors (no LLM): productivity, procrastination, task-structure, goal-alignment, workload. Outputs healthScore (0-100) with clear penalty/bonus logic. Patterns extracted from GitHub commit timestamps.

## Environment Variables

Required: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`
Optional: `GITHUB_BRANCH` (main), `BRAIN_BASE_PATH` (brain), `LOG_LEVEL` (info), `CACHE_TTL_MS` (30000), `WRITE_RETRIES` (3)

## Storage Layout (in GitHub repo)

```
brain/
├── inbox/capture.md
├── tasks/{today,backlog}.md
├── notes/{ideas,learning}.md
├── goals/{short-term,long-term}.md
└── knowledge/*.md              (topic files with YAML frontmatter)
```

## Language

Project documentation and embedded guides are primarily in Vietnamese. Server instructions in `src/mcp.ts` are also Vietnamese. Code, comments, and variable names are in English.
