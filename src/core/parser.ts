import { createHash } from "node:crypto";
import type { Task, TaskStatus, TaskPriority } from "../types/task.js";
import type { Note, Goal, InboxItem } from "../types/brain.js";

// ─── Regex patterns ────────────────────────────────────────

// Matches: `- [ ] text`, `* [x] text`, `1. [ ] text`, with optional leading whitespace
const TASK_REGEX = /^(\s*)(?:[-*]|\d+\.)\s*\[([xX ])\]\s*(.+)$/;
const TAG_REGEX = /#(\w[\w-]*)/g;
const DUE_REGEX = /@due\((\d{4}-\d{2}-\d{2})\)/;
const ESTIMATE_REGEX = /@est\(([^)]+)\)/;
const PRIORITY_REGEX = /^(!!!|!!|!)\s*/;
const FRONTMATTER_FENCE = /^---\s*$/;
const TIMESTAMP_REGEX = /^\[(\d{4}-\d{2}-\d{2}(?:[T ]\S+)?)\]\s*/;
const NESTED_META_REGEX = /^\s+[-*]\s*(\w[\w-]*)\s*:\s*(.+)$/;

// ─── Helpers ───────────────────────────────────────────────

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function generateId(source: string, text: string): string {
  return createHash("sha256")
    .update(`${source}::${text}`)
    .digest("hex")
    .substring(0, 8);
}

/**
 * Returns the line index where actual content starts (after frontmatter).
 */
function skipFrontmatter(lines: string[]): number {
  if (lines.length === 0 || !FRONTMATTER_FENCE.test(lines[0])) return 0;
  for (let i = 1; i < lines.length; i++) {
    if (FRONTMATTER_FENCE.test(lines[i])) return i + 1;
  }
  // Unclosed frontmatter — treat entire file as content
  return 0;
}

function extractPriority(text: string): { priority?: TaskPriority; cleaned: string } {
  const match = text.match(PRIORITY_REGEX);
  if (!match) return { cleaned: text };
  const markers = match[1];
  const priority: TaskPriority =
    markers === "!!!" ? "high" : markers === "!!" ? "medium" : "low";
  return { priority, cleaned: text.slice(markers.length).trimStart() };
}

function extractDueDate(text: string): { dueDate?: string; cleaned: string } {
  const match = text.match(DUE_REGEX);
  if (!match) return { cleaned: text };
  return {
    dueDate: match[1],
    cleaned: text.replace(DUE_REGEX, "").trim(),
  };
}

function parseEstimateValue(raw: string): number | undefined {
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minMatch = raw.match(/(\d+)\s*m/i);
  let minutes = 0;
  if (hourMatch) minutes += parseFloat(hourMatch[1]) * 60;
  if (minMatch) minutes += parseInt(minMatch[1]);
  return minutes > 0 ? minutes : undefined;
}

function extractEstimate(text: string): { estimate?: number; cleaned: string } {
  const match = text.match(ESTIMATE_REGEX);
  if (!match) return { cleaned: text };
  return {
    estimate: parseEstimateValue(match[1]),
    cleaned: text.replace(ESTIMATE_REGEX, "").trim(),
  };
}

function parsePriorityValue(raw: string): TaskPriority | undefined {
  const lower = raw.toLowerCase().trim();
  if (lower === "high" || lower === "h") return "high";
  if (lower === "medium" || lower === "med" || lower === "m") return "medium";
  if (lower === "low" || lower === "l") return "low";
  return undefined;
}

interface NestedMeta {
  priority?: TaskPriority;
  dueDate?: string;
  estimate?: number;
  tags?: string[];
}

/**
 * Looks ahead from startIndex for indented sub-bullets with key: value metadata.
 * Stops at the first non-indented line, blank line, or another task.
 */
function parseNestedMetadata(lines: string[], startIndex: number): NestedMeta {
  const result: NestedMeta = {};

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line.match(/^\s/) || !line.trim()) break;
    if (TASK_REGEX.test(line)) break;

    const metaMatch = line.match(NESTED_META_REGEX);
    if (!metaMatch) continue;

    const [, key, value] = metaMatch;
    switch (key.toLowerCase()) {
      case "priority":
        result.priority = parsePriorityValue(value);
        break;
      case "estimate":
      case "est":
        result.estimate = parseEstimateValue(value);
        break;
      case "tags":
      case "tag":
        result.tags = value.split(",").map((t) => t.trim()).filter(Boolean);
        break;
      case "due":
      case "duedate":
      case "due_date": {
        const dateStr = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) result.dueDate = dateStr;
        break;
      }
    }
  }

  return result;
}

function extractTags(text: string): { tags: string[]; cleaned: string } {
  const tags: string[] = [];
  const tagRegex = new RegExp(TAG_REGEX.source, TAG_REGEX.flags);
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(text)) !== null) {
    tags.push(m[1]);
  }
  const cleaned = text.replace(TAG_REGEX, "").replace(/\s{2,}/g, " ").trim();
  return { tags, cleaned };
}

// ─── Task Parsing ──────────────────────────────────────────

export function parseTasks(content: string, source: string): Task[] {
  const lines = normalizeLineEndings(content).split("\n");
  const start = skipFrontmatter(lines);
  const tasks: Task[] = [];

  for (let i = start; i < lines.length; i++) {
    const match = lines[i].match(TASK_REGEX);
    if (!match) continue;

    const [, , checkbox, rawText] = match;
    const status: TaskStatus = checkbox === " " ? "todo" : "done";

    let remaining = rawText;
    const { priority, cleaned: c1 } = extractPriority(remaining);
    remaining = c1;
    const { dueDate, cleaned: c2 } = extractDueDate(remaining);
    remaining = c2;
    const { estimate, cleaned: c3 } = extractEstimate(remaining);
    remaining = c3;
    const { tags, cleaned: text } = extractTags(remaining);

    // Look ahead for nested metadata sub-bullets (priority: high, estimate: 2h, etc.)
    const nested = parseNestedMetadata(lines, i + 1);

    tasks.push({
      id: generateId(source, rawText.trim()),
      text,
      status,
      tags: [...new Set([...tags, ...(nested.tags ?? [])])],
      priority: nested.priority ?? priority,
      dueDate: nested.dueDate ?? dueDate,
      estimate: nested.estimate ?? estimate,
      rawLine: lines[i],
      lineNumber: i,
      source,
    });
  }

  return tasks;
}

export function appendTask(content: string, taskText: string): string {
  const normalized = normalizeLineEndings(content);
  const newLine = `- [ ] ${taskText}`;

  if (!normalized.trim()) return newLine + "\n";

  const lines = normalized.split("\n");
  let lastTaskIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (TASK_REGEX.test(lines[i])) lastTaskIndex = i;
  }

  if (lastTaskIndex >= 0) {
    lines.splice(lastTaskIndex + 1, 0, newLine);
  } else {
    // Append after last non-empty line to avoid trailing blank gap
    let insertAt = lines.length;
    while (insertAt > 0 && !lines[insertAt - 1].trim()) insertAt--;
    lines.splice(insertAt, 0, newLine);
  }

  return lines.join("\n");
}

export function toggleTaskDone(
  content: string,
  taskId: string,
  source: string
): string {
  const normalized = normalizeLineEndings(content);
  const lines = normalized.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TASK_REGEX);
    if (!match) continue;

    const id = generateId(source, match[3].trim());
    if (id !== taskId) continue;

    if (match[2] === " ") {
      lines[i] = lines[i].replace("[ ]", "[x]");
    } else {
      lines[i] = lines[i].replace(/\[[xX]\]/, "[ ]");
    }
    return lines.join("\n");
  }

  throw new Error(`Task with id "${taskId}" not found`);
}

export function markTaskDoneByText(
  content: string,
  searchText: string
): string {
  const normalized = normalizeLineEndings(content);
  const lines = normalized.split("\n");
  const lower = searchText.toLowerCase();

  // First pass: exact prefix match on cleaned text
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TASK_REGEX);
    if (!match || match[2] !== " ") continue;
    const { cleaned } = extractTags(match[3]);
    if (cleaned.toLowerCase().startsWith(lower)) {
      lines[i] = lines[i].replace("[ ]", "[x]");
      return lines.join("\n");
    }
  }

  // Second pass: substring match on raw text
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TASK_REGEX);
    if (!match || match[2] !== " ") continue;
    if (match[3].toLowerCase().includes(lower)) {
      lines[i] = lines[i].replace("[ ]", "[x]");
      return lines.join("\n");
    }
  }

  throw new Error(`No open task matching "${searchText}" found`);
}

// ─── Task Removal & Replacement ─────────────────────────────

/**
 * Removes tasks by their IDs from file content.
 * Also removes any nested metadata sub-bullets belonging to removed tasks.
 */
export function removeTasksByIds(
  content: string,
  idsToRemove: Set<string>,
  source: string
): string {
  if (idsToRemove.size === 0) return content;

  const lines = normalizeLineEndings(content).split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(TASK_REGEX);
    if (match) {
      const id = generateId(source, match[3].trim());
      if (idsToRemove.has(id)) {
        i++;
        // Skip nested sub-bullets
        while (i < lines.length) {
          if (!lines[i].match(/^\s/) || !lines[i].trim()) break;
          if (TASK_REGEX.test(lines[i])) break;
          i++;
        }
        continue;
      }
    }
    result.push(lines[i]);
    i++;
  }

  return result.join("\n");
}

/**
 * Replaces a single task (by ID) with new lines in place.
 * Also removes any nested metadata sub-bullets of the replaced task.
 */
export function replaceTaskWithLines(
  content: string,
  taskId: string,
  source: string,
  newLines: string[]
): string {
  const lines = normalizeLineEndings(content).split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(TASK_REGEX);
    if (match) {
      const id = generateId(source, match[3].trim());
      if (id === taskId) {
        result.push(...newLines);
        i++;
        while (i < lines.length) {
          if (!lines[i].match(/^\s/) || !lines[i].trim()) break;
          if (TASK_REGEX.test(lines[i])) break;
          i++;
        }
        continue;
      }
    }
    result.push(lines[i]);
    i++;
  }

  return result.join("\n");
}

// ─── Bullet-list Parsing (notes, goals, inbox) ────────────

interface BulletItem {
  text: string;
  heading?: string;
  timestamp?: string;
}

function parseBulletList(content: string): BulletItem[] {
  const lines = normalizeLineEndings(content).split("\n");
  const start = skipFrontmatter(lines);
  const items: BulletItem[] = [];
  let currentHeading: string | undefined;

  for (let i = start; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Track headings
    if (trimmed.startsWith("#")) {
      currentHeading = trimmed.replace(/^#+\s*/, "");
      continue;
    }

    // Skip task-like items
    if (TASK_REGEX.test(trimmed)) continue;

    // Strip bullet prefix
    const bulletStripped = trimmed.replace(/^(?:[-*]|\d+\.)\s*/, "");
    if (!bulletStripped) continue;

    // Extract optional timestamp
    const tsMatch = bulletStripped.match(TIMESTAMP_REGEX);
    const timestamp = tsMatch ? tsMatch[1] : undefined;
    const text = tsMatch ? bulletStripped.slice(tsMatch[0].length) : bulletStripped;

    if (text) {
      items.push({ text, heading: currentHeading, timestamp });
    }
  }

  return items;
}

// ─── Note Parsing ──────────────────────────────────────────

export function parseNotes(content: string, source: string): Note[] {
  return parseBulletList(content).map((item) => ({
    text: item.text,
    heading: item.heading,
    source,
  }));
}

export function appendNote(content: string, noteText: string): string {
  const normalized = normalizeLineEndings(content);
  const timestamp = new Date().toISOString().split("T")[0];
  const newLine = `- [${timestamp}] ${noteText}`;

  if (!normalized.trim()) return newLine + "\n";

  const base = normalized.endsWith("\n") ? normalized : normalized + "\n";
  return base + newLine + "\n";
}

// ─── Goal Parsing ──────────────────────────────────────────

export function parseGoals(content: string, source: string): Goal[] {
  return parseBulletList(content).map((item) => ({
    text: item.text,
    heading: item.heading,
    source,
  }));
}

// ─── Inbox Parsing ─────────────────────────────────────────

export function parseInbox(content: string): InboxItem[] {
  return parseBulletList(content).map((item) => ({
    text: item.text,
    timestamp: item.timestamp,
  }));
}

export function appendInboxItem(content: string, text: string): string {
  const normalized = normalizeLineEndings(content);
  const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
  const newLine = `- [${timestamp}] ${text}`;

  if (!normalized.trim()) return newLine + "\n";

  const base = normalized.endsWith("\n") ? normalized : normalized + "\n";
  return base + newLine + "\n";
}

// ─── Archive ────────────────────────────────────────────────

/**
 * Appends archived task lines under the correct date heading in archive.md.
 * Creates the date heading if it doesn't exist (inserted at top, after `# Archive` header).
 */
export function appendToArchive(
  archiveContent: string,
  entries: string[],
  dateStr: string
): string {
  if (entries.length === 0) return archiveContent;

  const normalized = normalizeLineEndings(archiveContent);
  const lines = normalized.split("\n");

  const heading = `## ${dateStr}`;

  // Find existing date heading
  let headingIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) {
      headingIndex = i;
      break;
    }
  }

  if (headingIndex >= 0) {
    // Find insertion point: after the heading and existing entries, before next ## or EOF
    let insertAt = headingIndex + 1;
    while (insertAt < lines.length) {
      const trimmed = lines[insertAt].trim();
      if (trimmed.startsWith("## ")) break;
      insertAt++;
    }
    // Back up past trailing blank lines
    while (insertAt > headingIndex + 1 && !lines[insertAt - 1].trim()) {
      insertAt--;
    }
    lines.splice(insertAt, 0, ...entries);
  } else {
    // Insert new date heading after the # Archive header + blank line
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith("# ")) {
        insertAt = i + 1;
        // Skip blank lines after header
        while (insertAt < lines.length && !lines[insertAt].trim()) insertAt++;
        break;
      }
    }
    // Insert before the first existing ## (newest date on top)
    const block = [heading, "", ...entries, ""];
    lines.splice(insertAt, 0, ...block);
  }

  let result = lines.join("\n");
  if (!result.endsWith("\n")) result += "\n";
  return result;
}
