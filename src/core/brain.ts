import type { BrainSync } from "../github/sync.js";
import type { Task } from "../types/task.js";
import type { Note, Goal, InboxItem, BrainSection } from "../types/brain.js";
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

export class Brain {
  constructor(private sync: BrainSync) {}

  // ─── Read Operations ────────────────────────────────────

  async getTasks(
    section: "today" | "backlog"
  ): Promise<Task[]> {
    const brainSection: BrainSection = `tasks/${section}`;
    try {
      const file = await this.sync.readSection(brainSection);
      return parseTasks(file.content, brainSection);
    } catch (err: any) {
      if (err.message?.includes("not found")) return [];
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

  async getNotes(
    section: "ideas" | "learning"
  ): Promise<Note[]> {
    const brainSection: BrainSection = `notes/${section}`;
    try {
      const file = await this.sync.readSection(brainSection);
      return parseNotes(file.content, brainSection);
    } catch (err: any) {
      if (err.message?.includes("not found")) return [];
      throw err;
    }
  }

  async getGoals(
    section: "short-term" | "long-term"
  ): Promise<Goal[]> {
    const brainSection: BrainSection = `goals/${section}`;
    try {
      const file = await this.sync.readSection(brainSection);
      return parseGoals(file.content, brainSection);
    } catch (err: any) {
      if (err.message?.includes("not found")) return [];
      throw err;
    }
  }

  async getInbox(): Promise<InboxItem[]> {
    try {
      const file = await this.sync.readSection("inbox");
      return parseInbox(file.content);
    } catch (err: any) {
      if (err.message?.includes("not found")) return [];
      throw err;
    }
  }

  // ─── Write Operations ───────────────────────────────────

  async addTask(
    text: string,
    target: "today" | "backlog"
  ): Promise<Task> {
    const section: BrainSection = `tasks/${target}`;
    let content: string;
    let sha: string;

    try {
      const file = await this.sync.readSection(section);
      content = appendTask(file.content, text);
      sha = file.sha;
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        // File doesn't exist yet — create it
        content = `# ${target === "today" ? "Today" : "Backlog"}\n\n- [ ] ${text}\n`;
        await this.sync.createSection(
          section,
          content,
          `feat(ai): create ${target} with new task`
        );
        const tasks = parseTasks(content, section);
        return tasks[tasks.length - 1];
      }
      throw err;
    }

    await this.sync.writeSection(
      section,
      content,
      sha,
      `feat(ai): add task to ${target}`
    );

    const tasks = parseTasks(content, section);
    return tasks[tasks.length - 1];
  }

  async markTaskDone(
    section: "today" | "backlog",
    taskId: string
  ): Promise<void> {
    const brainSection: BrainSection = `tasks/${section}`;
    const file = await this.sync.readSection(brainSection);
    const newContent = toggleTaskDone(file.content, taskId, brainSection);

    await this.sync.writeSection(
      brainSection,
      newContent,
      file.sha,
      `feat(ai): mark task done`
    );
  }

  async markTaskDoneByText(
    section: "today" | "backlog",
    searchText: string
  ): Promise<void> {
    const brainSection: BrainSection = `tasks/${section}`;
    const file = await this.sync.readSection(brainSection);
    const newContent = markTaskDoneByText(file.content, searchText);

    await this.sync.writeSection(
      brainSection,
      newContent,
      file.sha,
      `feat(ai): mark task done`
    );
  }

  async addNote(
    text: string,
    section: "ideas" | "learning"
  ): Promise<void> {
    const brainSection: BrainSection = `notes/${section}`;
    let content: string;
    let sha: string;

    try {
      const file = await this.sync.readSection(brainSection);
      content = appendNote(file.content, text);
      sha = file.sha;
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        const title = section === "ideas" ? "Ideas" : "Learning";
        content = `# ${title}\n\n`;
        content = appendNote(content, text);
        await this.sync.createSection(
          brainSection,
          content,
          `feat(ai): create ${section} with new note`
        );
        return;
      }
      throw err;
    }

    await this.sync.writeSection(
      brainSection,
      content,
      sha,
      `feat(ai): add note to ${section}`
    );
  }

  async saveToInbox(text: string): Promise<void> {
    let content: string;
    let sha: string;

    try {
      const file = await this.sync.readSection("inbox");
      content = appendInboxItem(file.content, text);
      sha = file.sha;
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        content = `# Inbox\n\n`;
        content = appendInboxItem(content, text);
        await this.sync.createSection(
          "inbox",
          content,
          `feat(ai): create inbox with new item`
        );
        return;
      }
      throw err;
    }

    await this.sync.writeSection(
      "inbox",
      content,
      sha,
      `feat(ai): save to inbox`
    );
  }
}
