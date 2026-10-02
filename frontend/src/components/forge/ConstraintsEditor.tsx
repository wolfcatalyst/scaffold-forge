"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { severityStyles } from "@/components/wizard/OptionGroup";
import type { ConditionValue, ConstraintDef, OptionsFile } from "@/lib/api";
import { Field, inputClass, typingKey } from "./shared";

interface Props {
  constraints: ConstraintDef[];
  options: OptionsFile;
  knownFields: string[];
  onChange: (constraints: ConstraintDef[]) => void;
}

interface Row {
  field: string;
  op: "is" | "not";
  values: string[];
}

function toRows(condition: Record<string, ConditionValue>): Row[] {
  return Object.entries(condition).map(([field, value]) => {
    const negated = typeof value === "object" && !Array.isArray(value);
    const raw = negated ? value.not : value;
    return { field, op: negated ? "not" : "is", values: Array.isArray(raw) ? raw : [raw] };
  });
}

function fromRows(rows: Row[]): Record<string, ConditionValue> {
  const out: Record<string, ConditionValue> = {};
  for (const r of rows) {
    if (!r.field) continue;
    const v = r.values.length === 1 ? r.values[0] : r.values;
    out[r.field] = r.op === "not" ? { not: v } : v;
  }
  return out;
}

/** Known values for a condition field, for the checkbox picker. */
function choicesFor(field: string, options: OptionsFile): { id: string; label: string }[] | null {
  const group = options.stack[field];
  if (group?.options) return group.options;
  const intent = (options.intent as Record<string, { id: string; label: string }[]>)[field];
  if (Array.isArray(intent)) return intent;
  if (field in (options.data_lifecycle ?? {})) return [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }];
  if (field === "data_lifecycle_result") {
    return ["ephemeral", "json_or_sqlite", "relational"].map((id) => ({ id, label: id }));
  }
  return null;
}

export default function ConstraintsEditor({ constraints, options, knownFields, onChange }: Props) {
  const [open, setOpen] = useState<number | null>(null);

  const update = (i: number, patch: Partial<ConstraintDef>) =>
    onChange(constraints.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const add = () => {
    let n = constraints.length + 1;
    while (constraints.some((c) => c.id === `rule-${n}`)) n++;
    onChange([...constraints, { id: `rule-${n}`, if: {}, severity: "warn", message: "" }]);
    setOpen(constraints.length);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        A constraint fires when <em>all</em> of its conditions match. <strong>Hard</strong> blocks generation,{" "}
        <strong>error</strong> and <strong>warn</strong> flag the options in the wizard, <strong>info</strong> only
        shows on the Review step.
      </p>
      <div className="space-y-1.5">
        {constraints.map((c, i) => (
          <div key={i} className="rounded-md border border-border bg-card">
            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setOpen(open === i ? null : i)}>
              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${severityStyles[c.severity]}`}>
                {c.severity}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
              <span className="flex-1 truncate text-sm">{c.message}</span>
            </div>
            {open === i && (
              <ConstraintForm
                constraint={c}
                options={options}
                knownFields={knownFields}
                onChange={(patch) => update(i, patch)}
                onDelete={() => { onChange(constraints.filter((_, j) => j !== i)); setOpen(null); }}
              />
            )}
          </div>
        ))}
      </div>
      <Button size="sm" variant="secondary" onClick={add}>+ Add constraint</Button>
    </div>
  );
}

function ConstraintForm({
  constraint,
  options,
  knownFields,
  onChange,
  onDelete,
}: {
  constraint: ConstraintDef;
  options: OptionsFile;
  knownFields: string[];
  onChange: (patch: Partial<ConstraintDef>) => void;
  onDelete: () => void;
}) {
  const rows = toRows(constraint.if);
  const [thenText, setThenText] = useState(JSON.stringify(constraint.then ?? {}, null, 2));
  const [thenError, setThenError] = useState("");

  const setRows = (next: Row[]) => onChange({ if: fromRows(next) });
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const unusedFields = knownFields.filter((f) => !rows.some((r) => r.field === f));

  return (
    <div className="space-y-3 border-t border-border p-3">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="ID">
          <input
            className={`${inputClass} font-mono text-xs`}
            value={constraint.id}
            onChange={(e) => onChange({ id: typingKey(e.target.value, "-") })}
          />
        </Field>
        <Field label="Severity">
          <select
            className={inputClass}
            value={constraint.severity}
            onChange={(e) => onChange({ severity: e.target.value as ConstraintDef["severity"] })}
          >
            <option value="hard">hard: blocks generation</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
          </select>
        </Field>
      </div>

      <Field label="Conditions (all must match)">
        <div className="space-y-2">
          {rows.map((r, i) => {
            const choices = choicesFor(r.field, options);
            return (
              <div key={i} className="rounded border border-border p-2 space-y-2">
                <div className="flex gap-2">
                  <select className={inputClass} value={r.field} onChange={(e) => setRow(i, { field: e.target.value, values: [] })}>
                    <option value={r.field}>{r.field}</option>
                    {unusedFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <select
                    className={`${inputClass} w-40`}
                    value={r.op}
                    onChange={(e) => setRow(i, { op: e.target.value as Row["op"] })}
                  >
                    <option value="is">is any of</option>
                    <option value="not">is not</option>
                  </select>
                  <button className="px-2 text-red-500 opacity-70 hover:opacity-100" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </div>
                {choices ? (
                  <div className="flex flex-wrap gap-1">
                    {choices.map((ch) => {
                      const on = r.values.includes(ch.id);
                      return (
                        <button
                          key={ch.id}
                          onClick={() => setRow(i, { values: on ? r.values.filter((v) => v !== ch.id) : [...r.values, ch.id] })}
                          className={`px-2 py-0.5 rounded text-xs border ${on ? "border-primary bg-primary/15" : "border-border hover:bg-accent"}`}
                        >
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    className={inputClass}
                    placeholder="Values, comma separated"
                    value={r.values.join(", ")}
                    onChange={(e) => setRow(i, { values: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
                  />
                )}
              </div>
            );
          })}
          {unusedFields.length > 0 && (
            <select
              className={inputClass}
              value=""
              onChange={(e) => e.target.value && setRows([...rows, { field: e.target.value, op: "is", values: [] }])}
            >
              <option value="">+ Add condition…</option>
              {unusedFields.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}
        </div>
      </Field>

      <Field label="Message">
        <textarea className={inputClass} rows={2} value={constraint.message} onChange={(e) => onChange({ message: e.target.value })} />
      </Field>
      <Field label="War story (optional)" hint="A real incident that explains why this rule exists.">
        <textarea
          className={inputClass}
          rows={2}
          value={constraint.war_story ?? ""}
          onChange={(e) => onChange({ war_story: e.target.value || undefined })}
        />
      </Field>
      <Field
        label="Then (advanced, JSON)"
        hint='Optional. "require" / "set" / "suggest" ({"docker": "no"}) power the Fix button; "hide" (["database"]) hides option groups.'
      >
        <textarea
          className={`${inputClass} font-mono text-xs`}
          rows={3}
          value={thenText}
          onChange={(e) => {
            setThenText(e.target.value);
            try {
              const parsed = JSON.parse(e.target.value || "{}");
              if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) throw new Error();
              setThenError("");
              onChange({ then: parsed });
            } catch {
              setThenError("Not valid JSON object; changes here won't be kept until it is.");
            }
          }}
        />
      </Field>
      {thenError && <p className="text-xs text-red-500">{thenError}</p>}

      <Button size="sm" variant="ghost" className="text-red-500" onClick={onDelete}>Delete constraint</Button>
    </div>
  );
}
