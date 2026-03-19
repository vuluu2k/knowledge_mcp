export type ActionType =
  | "autoReschedule"
  | "autoSplitTask"
  | "autoPrioritize"
  | "autoCleanup"
  | "autoInjectTask"
  | "autoArchive";

export interface PlannedAction {
  type: ActionType;
  reason: string;
  impact: string;
  details: string[];
}

export interface AutoActionResult {
  dryRun: boolean;
  actions: PlannedAction[];
  changes: string[];
  summary: string;
}
