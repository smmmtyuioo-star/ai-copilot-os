export type Severity = "Critical" | "High" | "Medium" | "Low";

export interface PatternDef {
  name: string | null;
  pattern: string;
  flags: string;
  reason?: string;
  severity?: Severity;
}

export interface SafePatternDef {
  name: string;
  pattern: string;
  flags: string;
}

export interface PackDef {
  id: string;
  name: string;
  keywords: string[];
  category: string;
  source_file: string;
  destructive_patterns: PatternDef[];
  safe_patterns: SafePatternDef[];
}

export interface Match {
  packId: string;
  packName: string;
  patternName: string | null;
  severity: Severity;
  reason: string;
}

export interface GuardResult {
  command: string;
  allowed: boolean;
  severity: Severity | null;
  matches: Match[];
  /** Safe-pattern hits that suppressed a destructive match in the same pack */
  suppressedByPackId: string[];
}
