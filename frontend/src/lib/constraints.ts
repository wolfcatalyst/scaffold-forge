import type { ConditionValue, ConstraintDef, ScaffoldConfig } from "./api";

export type Severity = ConstraintDef["severity"];
export const SEVERITY_RANK: Record<Severity, number> = { hard: 0, error: 1, warn: 2, info: 3 };

/** Mirrors DataLifecycle.result in backend/app/core/models.py. */
function dataLifecycleResult(dl: ScaffoldConfig["data_lifecycle"]): string {
  const yes = Object.values(dl).filter((v) => v === "yes").length;
  if (yes === 0) return "ephemeral";
  if (dl.search_query === "no" && dl.user_data_isolation === "no") return "json_or_sqlite";
  return "relational";
}

export function flattenConfig(config: ScaffoldConfig): Record<string, unknown> {
  return {
    project_name: config.project_name,
    ...config.intent,
    data_lifecycle_result: dataLifecycleResult(config.data_lifecycle),
    ...config.data_lifecycle,
    ...config.stack,
  };
}

/** Mirrors _match_condition in backend/app/core/constraints.py. */
function matchValue(expected: ConditionValue, actual: unknown): boolean {
  if (actual === undefined || actual === null) return false;
  if (typeof expected === "object" && !Array.isArray(expected)) {
    return !matchValue(expected.not, actual);
  }
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      ? expected.some((e) => actual.includes(e))
      : expected.includes(actual as string);
  }
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

export function matches(constraint: ConstraintDef, flat: Record<string, unknown>): boolean {
  const entries = Object.entries(constraint.if ?? {});
  return entries.length > 0 && entries.every(([key, expected]) => matchValue(expected, flat[key]));
}

export function evaluate(constraints: ConstraintDef[], config: ScaffoldConfig): ConstraintDef[] {
  const flat = flattenConfig(config);
  return constraints
    .filter((c) => matches(c, flat))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export interface OptionStatus {
  severity: Severity;
  messages: string[];
}

/**
 * What would happen if `optionId` were picked for `groupKey`: the constraints
 * involving this group that would newly fire. Only blocking/error/warn levels
 * are surfaced so informational rules don't clutter the options.
 */
export function previewOption(
  constraints: ConstraintDef[],
  config: ScaffoldConfig,
  groupKey: string,
  optionId: string,
  multi: boolean,
): OptionStatus | null {
  const current = config.stack[groupKey];
  let next: string | string[];
  if (multi) {
    const list = Array.isArray(current) ? current : [];
    if (list.includes(optionId)) return null;
    next = [...list, optionId];
  } else {
    if (current === optionId) return null;
    next = optionId;
  }
  const before = new Set(evaluate(constraints, config).map((c) => c.id));
  const hypothetical = { ...config, stack: { ...config.stack, [groupKey]: next } };
  const fired = evaluate(constraints, hypothetical).filter(
    (c) => !before.has(c.id) && groupKey in c.if && c.severity !== "info",
  );
  if (!fired.length) return null;
  return { severity: fired[0].severity, messages: fired.map((c) => c.message) };
}

/** Currently-firing constraints that involve a given option group. */
export function activeForGroup(active: ConstraintDef[], groupKey: string): ConstraintDef[] {
  return active.filter((c) => groupKey in c.if);
}

/** Groups hidden by an active constraint's `then.hide`. */
export function hiddenGroups(active: ConstraintDef[]): Set<string> {
  const hidden = new Set<string>();
  for (const c of active) {
    const hide = c.then?.hide;
    if (Array.isArray(hide)) hide.forEach((g) => hidden.add(String(g)));
  }
  return hidden;
}

/** A one-click fix from `then.require`, `then.suggest` or `then.set`. */
export function quickFix(constraint: ConstraintDef): Record<string, string> | null {
  for (const key of ["require", "set", "suggest"]) {
    const fix = constraint.then?.[key];
    if (fix && typeof fix === "object" && !Array.isArray(fix)) {
      return fix as Record<string, string>;
    }
  }
  return null;
}
