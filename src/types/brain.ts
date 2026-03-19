export interface FileContent {
  content: string;
  sha: string;
  path: string;
}

export interface BrainConfig {
  owner: string;
  repo: string;
  branch: string;
  basePath: string;
}

export type BrainSection =
  | "inbox"
  | "tasks/today"
  | "tasks/backlog"
  | "tasks/archive"
  | "notes/ideas"
  | "notes/learning"
  | "goals/short-term"
  | "goals/long-term";

export const BRAIN_FILE_MAP: Record<BrainSection, string> = {
  inbox: "inbox/capture.md",
  "tasks/today": "tasks/today.md",
  "tasks/backlog": "tasks/backlog.md",
  "tasks/archive": "tasks/archive.md",
  "notes/ideas": "notes/ideas.md",
  "notes/learning": "notes/learning.md",
  "goals/short-term": "goals/short-term.md",
  "goals/long-term": "goals/long-term.md",
};

export interface Note {
  text: string;
  heading?: string;
  source: string;
}

export interface Goal {
  text: string;
  heading?: string;
  source: string;
}

export interface InboxItem {
  text: string;
  timestamp?: string;
}
