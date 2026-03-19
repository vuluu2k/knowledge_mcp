import type { BrainSync } from "../github/sync.js";
import type { Task } from "../types/task.js";
import type { Note, Goal, InboxItem, BrainSection } from "../types/brain.js";
import { isNotFound } from "../errors.js";
import { getLogger } from "../logger.js";
import {
  parseTasks,
  appendTask,
  toggleTaskDone,
  markTaskDoneByText,
  parseNotes,
  appendNote,
  parseGoals,
  parseInbox,
  appendInboxItem,
} from "./parser.js";

// Default templates for brain files
const BRAIN_TEMPLATES: Array<{ section: string; content: string }> = [
  {
    section: "inbox/capture.md",
    content: "# Inbox\n\nCapture quick thoughts here.\n",
  },
  {
    section: "tasks/today.md",
    content: "# Today\n\n- [ ] Get started with your AI brain\n",
  },
  {
    section: "tasks/backlog.md",
    content: "# Backlog\n\n",
  },
  {
    section: "notes/ideas.md",
    content: "# Ideas\n\n",
  },
  {
    section: "notes/learning.md",
    content: "# Learning\n\n",
  },
  {
    section: "goals/short-term.md",
    content: "# Short-Term Goals\n\n",
  },
  {
    section: "goals/long-term.md",
    content: "# Long-Term Goals\n\n",
  },
  {
    section: "knowledge/general.md",
    content: "# General\n\n## Welcome\n\nThis is your knowledge base. Add entries with `addKnowledge` tool.\n",
  },
];

export class Brain {
  constructor(private sync: BrainSync) {}

  // ─── Init ───────────────────────────────────────────────

  async initBrain(): Promise<{ created: string[] }> {
    const log = getLogger();

    // Check if brain already exists by trying to read any section
    try {
      await this.sync.readSection("inbox");
      throw new Error(
        "Brain already initialized — inbox/capture.md exists. Use the other tools to manage your brain."
      );
    } catch (err) {
      if (!isNotFound(err)) throw err;
      // Not found = good, proceed with init
    }

    await this.sync.createFiles(
      BRAIN_TEMPLATES,
      "feat(ai): initialize brain structure"
    );

    const created = BRAIN_TEMPLATES.map((t) => t.section);
    log.info("initBrain", { created });
    return { created };
  }

  // ─── Read Operations ────────────────────────────────────

  async getTasks(section: "today" | "backlog"): Promise<Task[]> {
    const log = getLogger();
    const brainSection: BrainSection = `tasks/${section}`;
    try {
      const file = await this.sync.readSection(brainSection);
      const tasks = parseTasks(file.content, brainSection);
      log.info("getTasks", { section, count: tasks.length });
      return tasks;
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  async getAllTasks(): Promise<{ today: Task[]; backlog: Task[] }> {
    const [today, backlog] = await Promise.all([
      this.getTasks("today"),
      this.getTasks("backlog"),
    ]);
    return { today, backlog };
  }

  async getNotes(section: "ideas" | "learning"): Promise<Note[]> {
    const brainSection: BrainSection = `notes/${section}`;
    try {
      const file = await this.sync.readSection(brainSection);
      return parseNotes(file.content, brainSection);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  async getGoals(section: "short-term" | "long-term"): Promise<Goal[]> {
    const brainSection: BrainSection = `goals/${section}`;
    try {
      const file = await this.sync.readSection(brainSection);
      return parseGoals(file.content, brainSection);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  async getInbox(): Promise<InboxItem[]> {
    try {
      const file = await this.sync.readSection("inbox");
      return parseInbox(file.content);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  // ─── Write Operations ───────────────────────────────────

  async addTask(text: string, target: "today" | "backlog"): Promise<Task> {
    const log = getLogger();
    const section: BrainSection = `tasks/${target}`;

    try {
      const result = await this.sync.atomicUpdate(
        section,
        (current) => appendTask(current, text),
        `feat(ai): add task to ${target}`
      );
      const tasks = parseTasks(result.content, section);
      log.info("addTask", { target, text });
      return tasks[tasks.length - 1];
    } catch (err) {
      if (isNotFound(err)) {
        const title = target === "today" ? "Today" : "Backlog";
        const content = `# ${title}\n\n- [ ] ${text}\n`;
        await this.sync.createSection(
          section,
          content,
          `feat(ai): create ${target} with new task`
        );
        log.info("addTask: created file", { target, text });
        const tasks = parseTasks(content, section);
        return tasks[tasks.length - 1];
      }
      throw err;
    }
  }

  async markTaskDone(
    section: "today" | "backlog",
    taskId: string
  ): Promise<void> {
    const log = getLogger();
    const brainSection: BrainSection = `tasks/${section}`;

    await this.sync.atomicUpdate(
      brainSection,
      (current) => toggleTaskDone(current, taskId, brainSection),
      `feat(ai): mark task done`
    );
    log.info("markTaskDone", { section, taskId });
  }

  async markTaskDoneByText(
    section: "today" | "backlog",
    searchText: string
  ): Promise<void> {
    const log = getLogger();
    const brainSection: BrainSection = `tasks/${section}`;

    await this.sync.atomicUpdate(
      brainSection,
      (current) => markTaskDoneByText(current, searchText),
      `feat(ai): mark task done`
    );
    log.info("markTaskDoneByText", { section, searchText });
  }

  async addNote(text: string, section: "ideas" | "learning"): Promise<void> {
    const log = getLogger();
    const brainSection: BrainSection = `notes/${section}`;

    try {
      await this.sync.atomicUpdate(
        brainSection,
        (current) => appendNote(current, text),
        `feat(ai): add note to ${section}`
      );
      log.info("addNote", { section, text });
    } catch (err) {
      if (isNotFound(err)) {
        const title = section === "ideas" ? "Ideas" : "Learning";
        const content = appendNote(`# ${title}\n\n`, text);
        await this.sync.createSection(
          brainSection,
          content,
          `feat(ai): create ${section} with new note`
        );
        log.info("addNote: created file", { section });
        return;
      }
      throw err;
    }
  }

  async saveToInbox(text: string): Promise<void> {
    const log = getLogger();

    try {
      await this.sync.atomicUpdate(
        "inbox",
        (current) => appendInboxItem(current, text),
        `feat(ai): save to inbox`
      );
      log.info("saveToInbox", { text });
    } catch (err) {
      if (isNotFound(err)) {
        const content = appendInboxItem(`# Inbox\n\n`, text);
        await this.sync.createSection(
          "inbox",
          content,
          `feat(ai): create inbox with new item`
        );
        log.info("saveToInbox: created file");
        return;
      }
      throw err;
    }
  }
}
