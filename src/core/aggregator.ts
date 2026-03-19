import type { Brain } from "./brain.js";
import type { Task } from "../types/task.js";

export class Aggregator {
  constructor(private brain: Brain) {}

  async getAllTasks(): Promise<{ today: Task[]; backlog: Task[] }> {
    return this.brain.getAllTasks();
  }

  async getOpenTasks(): Promise<{ today: Task[]; backlog: Task[] }> {
    const all = await this.brain.getAllTasks();
    return {
      today: all.today.filter((t) => t.status === "todo"),
      backlog: all.backlog.filter((t) => t.status === "todo"),
    };
  }

  async getTasksByTag(tag: string): Promise<Task[]> {
    const all = await this.brain.getAllTasks();
    return [...all.today, ...all.backlog].filter((t) => t.tags.includes(tag));
  }

  async getStats(): Promise<{
    totalTasks: number;
    completedTasks: number;
    openTasks: number;
    todayCount: number;
    backlogCount: number;
  }> {
    const all = await this.brain.getAllTasks();
    const combined = [...all.today, ...all.backlog];
    return {
      totalTasks: combined.length,
      completedTasks: combined.filter((t) => t.status === "done").length,
      openTasks: combined.filter((t) => t.status === "todo").length,
      todayCount: all.today.length,
      backlogCount: all.backlog.length,
    };
  }
}
