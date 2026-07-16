import type { PackDef, Match, GuardResult, Severity } from "./types.js";
import patternsJson from "../data/patterns.json" with { type: "json" };

const PACKS = patternsJson as unknown as PackDef[];

const SEVERITY_RANK: Record<Severity, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

/** Lazily-compiled regex cache, mirroring dcg's LazyCompiledRegex approach. */
const regexCache = new Map<string, RegExp>();
function compile(pattern: string, flags: string): RegExp {
  const key = flags + "\u0000" + pattern;
  let re = regexCache.get(key);
  if (!re) {
    re = new RegExp(pattern, flags);
    regexCache.set(key, re);
  }
  return re;
}

export interface GuardOptions {
  /** Restrict evaluation to specific pack IDs (e.g. ["core.git", "database.postgres"]). Default: all packs. */
  enabledPackIds?: string[];
  /** Pack IDs to skip entirely. */
  disabledPackIds?: string[];
  /** Minimum severity that should cause `allowed: false`. Default: "Low" (anything blocks). */
  minBlockingSeverity?: Severity;
}

function enabledPacks(opts: GuardOptions): PackDef[] {
  let packs = PACKS;
  if (opts.enabledPackIds) {
    const set = new Set(opts.enabledPackIds);
    packs = packs.filter((p) => set.has(p.id));
  }
  if (opts.disabledPackIds) {
    const set = new Set(opts.disabledPackIds);
    packs = packs.filter((p) => !set.has(p.id));
  }
  return packs;
}

/**
 * Cheap pre-filter: only run a pack's regexes against the command if at least
 * one of its keywords appears in the (lowercased) command. Mirrors dcg's
 * "quick reject" optimization so you're not running ~1700 regexes per command.
 */
function packIsCandidate(pack: PackDef, lowerCommand: string): boolean {
  if (pack.keywords.length === 0) return true; // no keyword hint, always check
  return pack.keywords.some((kw) => lowerCommand.includes(kw.toLowerCase()));
}

/**
 * Evaluate a shell command string against the destructive-command-guard pattern
 * database extracted from dcg (github.com/... destructive_command_guard).
 *
 * Semantics (simplified vs. the real Rust engine — see README "Known limitations"):
 *  1. Packs are pre-filtered by keyword for speed.
 *  2. Within a candidate pack, if ANY safe_pattern matches, that pack's
 *     destructive_patterns are skipped (safe patterns take precedence, per-pack).
 *  3. Otherwise, every destructive_pattern in the pack is tested; each match is recorded.
 *  4. Across all packs, the command is denied if any match's severity >= minBlockingSeverity.
 *     The reported `severity` is the highest severity among all matches.
 */
export function evaluateCommand(command: string, opts: GuardOptions = {}): GuardResult {
  const lowerCommand = command.toLowerCase();
  const minRank = SEVERITY_RANK[opts.minBlockingSeverity ?? "Low"];
  const matches: Match[] = [];
  const suppressedByPackId: string[] = [];

  for (const pack of enabledPacks(opts)) {
    if (!packIsCandidate(pack, lowerCommand)) continue;

    const safeHit = pack.safe_patterns.some((sp) => {
      try {
        return compile(sp.pattern, sp.flags || "").test(command);
      } catch {
        return false; // defensively skip any pattern that fails to compile at runtime
      }
    });
    if (safeHit) {
      suppressedByPackId.push(pack.id);
      continue;
    }

    for (const dp of pack.destructive_patterns) {
      let hit = false;
      try {
        hit = compile(dp.pattern, dp.flags || "").test(command);
      } catch {
        continue;
      }
      if (hit) {
        matches.push({
          packId: pack.id,
          packName: pack.name,
          patternName: dp.name,
          severity: dp.severity ?? "High",
          reason: dp.reason ?? "Matched a known destructive-command pattern.",
        });
      }
    }
  }

  matches.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const topSeverity = matches[0]?.severity ?? null;
  const allowed = matches.every((m) => SEVERITY_RANK[m.severity] < minRank);

  return {
    command,
    allowed,
    severity: topSeverity,
    matches,
    suppressedByPackId,
  };
}

/** List all loaded packs (id, name, category, keyword count, pattern counts) — useful for building a settings UI. */
export function listPacks() {
  return PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    keywords: p.keywords,
    destructiveCount: p.destructive_patterns.length,
    safeCount: p.safe_patterns.length,
  }));
}
