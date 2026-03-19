export type TaskStatus = "todo" | "done";
export type TaskPriority = "high" | "medium" | "low";

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  tags: string[];
  priority?: TaskPriority;
  dueDate?: string;
  rawLine: string;
  lineNumber: number;
  source: string;
}
