"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OptionGroupDef, StepDef } from "@/lib/api";
import { Field, MoveButtons, dragProps, inputClass, move, typingKey } from "./shared";

interface Props {
  steps: StepDef[];
  groups: Record<string, OptionGroupDef>;
  onChange: (steps: StepDef[]) => void;
}

export default function StepsEditor({ steps, groups, onChange }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  const update = (index: number, patch: Partial<StepDef>) =>
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const reorder = (from: number, to: number) => onChange(move(steps, from, to));

  const addStep = () => {
    let n = steps.length + 1;
    while (steps.some((s) => s.id === `step_${n}`)) n++;
    const step: StepDef = { id: `step_${n}`, label: "New step", type: "options", description: "", option_groups: [] };
    // Keep Review & Generate last.
    const reviewIndex = steps.findIndex((s) => s.id === "review");
    const at = reviewIndex === -1 ? steps.length : reviewIndex;
    onChange([...steps.slice(0, at), step, ...steps.slice(at)]);
    setOpen(step.id);
  };

  const used = new Set(steps.flatMap((s) => s.option_groups ?? []));
  const unused = Object.keys(groups).filter((k) => !used.has(k));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Drag or use the arrows to reorder. The built-in steps (Project Intent, Data Lifecycle, Review &amp; Generate)
        can be moved and renamed but not removed.
      </p>
      {unused.length > 0 && (
        <p className="text-xs text-yellow-700 dark:text-yellow-400">
          Not shown in any step: {unused.map((k) => groups[k]?.label ?? k).join(", ")}
        </p>
      )}

      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const isOpen = open === step.id;
          const isNew = step.type === "options";
          return (
            // Not draggable while expanded, so text in its inputs can still be selected.
            <div key={i} className="rounded-md border border-border bg-card" {...dragProps(i, reorder)} draggable={!isOpen}>
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                onClick={() => setOpen(isOpen ? null : step.id)}
              >
                <span className="cursor-grab text-muted-foreground select-none" title="Drag to reorder">⠿</span>
                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                <span className="flex-1 text-sm font-medium truncate">{step.label}</span>
                <Badge variant="outline" className="text-[10px]">
                  {step.type === "custom" ? "built-in" : `${step.option_groups?.length ?? 0} groups`}
                </Badge>
                <MoveButtons index={i} count={steps.length} onMove={reorder} />
              </div>

              {isOpen && (
                <div className="space-y-3 border-t border-border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Label">
                      <input className={inputClass} value={step.label} onChange={(e) => update(i, { label: e.target.value })} />
                    </Field>
                    <Field label="ID" hint={isNew ? "Lowercase letters, digits, underscores." : "Built-in step IDs are fixed."}>
                      <input
                        className={inputClass}
                        value={step.id}
                        disabled={!isNew}
                        onChange={(e) => { update(i, { id: typingKey(e.target.value) }); setOpen(typingKey(e.target.value)); }}
                      />
                    </Field>
                  </div>
                  <Field label="Description">
                    <input
                      className={inputClass}
                      value={step.description ?? ""}
                      onChange={(e) => update(i, { description: e.target.value })}
                    />
                  </Field>

                  {step.type === "options" && (
                    <GroupPicker
                      selected={step.option_groups ?? []}
                      groups={groups}
                      onChange={(option_groups) => update(i, { option_groups })}
                    />
                  )}

                  {step.type === "options" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500"
                      onClick={() => onChange(steps.filter((_, j) => j !== i))}
                    >
                      Delete step
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button size="sm" variant="secondary" onClick={addStep}>+ Add step</Button>
    </div>
  );
}

function GroupPicker({
  selected,
  groups,
  onChange,
}: {
  selected: string[];
  groups: Record<string, OptionGroupDef>;
  onChange: (groups: string[]) => void;
}) {
  const available = Object.keys(groups).filter((k) => !selected.includes(k));
  return (
    <Field label="Option groups (in display order)">
      <div className="space-y-1">
        {selected.map((key, i) => (
          <div key={key} className="flex items-center gap-2 rounded bg-muted/60 px-2 py-1 text-sm">
            <span className="flex-1">
              {groups[key]?.label ?? <span className="text-red-500">{key} (missing)</span>}
              <span className="ml-2 text-xs text-muted-foreground">{key}</span>
            </span>
            <MoveButtons index={i} count={selected.length} onMove={(f, t) => onChange(move(selected, f, t))} />
            <button className="px-1 text-red-500 opacity-70 hover:opacity-100" onClick={() => onChange(selected.filter((k) => k !== key))}>
              ×
            </button>
          </div>
        ))}
        {available.length > 0 && (
          <select
            className={inputClass}
            value=""
            onChange={(e) => e.target.value && onChange([...selected, e.target.value])}
          >
            <option value="">+ Add an option group…</option>
            {available.map((k) => (
              <option key={k} value={k}>
                {groups[k].label} ({k})
              </option>
            ))}
          </select>
        )}
      </div>
    </Field>
  );
}
