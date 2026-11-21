export interface ChangedPath { path: string; status: string; }
export interface ChangeSnapshot {
  base: string;
  mergeBase: string;
  head: string;
  changes: ChangedPath[];
}
export interface CheckPlan {
  mode: 'full' | 'iteration' | 'no-changes';
  categories: string[];
  changes: ChangedPath[];
  commands: string[];
  fallback: string[];
  qualification: string;
  deferred: string[];
}
export function readChanges(cwd: string, base?: string): ChangeSnapshot;
export function planChecks(changes: ChangedPath[]): CheckPlan;
