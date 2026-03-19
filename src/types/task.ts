export type TaskStatus = "todo" | "done";
export type TaskPriority = "high" | "medium" | "low";

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  tags: string[];
  priority?: TaskPriority;
  dueDate?: string;
  /** Estimated effort in minutes. Parsed from @est(2h), @est(30m), or nested `estimate: 2h`. */
  estimate?: number;
  rawLine: string;
  lineNumber: number;
  source: string;
}
