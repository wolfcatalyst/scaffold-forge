"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import OptionGroup from "@/components/wizard/OptionGroup";
import type { ConstraintDef, OptionDef, OptionGroupDef, StepDef } from "@/lib/api";
import { Field, MoveButtons, inputClass, move, toKey, typingKey } from "./shared";

interface Props {
  groups: Record<string, OptionGroupDef>;
  steps: StepDef[];
  constraints: ConstraintDef[];
  onChange: (groups: Record<string, OptionGroupDef>) => void;
}

export default function OptionGroupsEditor({ groups, steps, constraints, onChange }: Props) {
  const keys = Object.keys(groups);
  const [selected, setSelected] = useState<string>(keys[0] ?? "");
  const [newKey, setNewKey] = useState("");
  const group = groups[selected];

  const updateGroup = (patch: Partial<OptionGroupDef>) =>
    onChange({ ...groups, [selected]: { ...group, ...patch } });

  const addGroup = () => {
    const key = toKey(newKey);
    if (!key || groups[key]) return;
    onChange({ ...groups, [key]: { label: newKey.trim(), options: [{ id: "none", label: "None" }] } });
    setSelected(key);
    setNewKey("");
  };

  const deleteGroup = () => {
    const next = { ...groups };
    delete next[selected];
    onChange(next);
    setSelected(Object.keys(next)[0] ?? "");
  };

  const usedInSteps = steps.filter((s) => s.option_groups?.includes(selected)).map((s) => s.label);
  const usedInConstraints = constraints.filter((c) => selected in c.if).map((c) => c.id);

  return (
    <div className="grid grid-cols-[200px_1fr] gap-4">
      <div className="space-y-1">
        <div className="max-h-[60vh] overflow-y-auto space-y-0.5 pr-1">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => setSelected(k)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm truncate ${
                k === selected ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              {groups[k].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 pt-2">
          <input
            className={inputClass}
            placeholder="New group name"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGroup()}
          />
          <Button size="sm" variant="secondary" onClick={addGroup} disabled={!toKey(newKey) || !!groups[toKey(newKey)]}>
            Add
          </Button>
        </div>
        {newKey && groups[toKey(newKey)] && <p className="text-[11px] text-red-500">That key already exists.</p>}
      </div>

      {group ? (
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label">
              <input className={inputClass} value={group.label} onChange={(e) => updateGroup({ label: e.target.value })} />
            </Field>
            <Field label="Key" hint="Used in configs, templates and constraints.">
              <input className={inputClass} value={selected} disabled />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={group.type === "textarea"}
                onChange={(e) =>
                  updateGroup(e.target.checked
                    ? { type: "textarea", options: undefined, multi_select: undefined, allow_other: undefined }
                    : { type: undefined, options: [{ id: "none", label: "None" }] })
                }
              />
              Free text
            </label>
            {group.type !== "textarea" && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!group.multi_select}
                    onChange={(e) => updateGroup({ multi_select: e.target.checked || undefined })}
                  />
                  Multiple choice
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!group.allow_other}
                    onChange={(e) => updateGroup({ allow_other: e.target.checked || undefined })}
                  />
                  Allow &quot;Other&quot;
                </label>
              </>
            )}
          </div>

          {group.type === "textarea" ? (
            <Field label="Placeholder">
              <input
                className={inputClass}
                value={group.placeholder ?? ""}
                onChange={(e) => updateGroup({ placeholder: e.target.value })}
              />
            </Field>
          ) : (
            <OptionsTable options={group.options ?? []} onChange={(options) => updateGroup({ options })} />
          )}

          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Shown in: {usedInSteps.length ? usedInSteps.join(", ") : <em>no step yet; add it on the Steps tab</em>}</p>
            {usedInConstraints.length > 0 && <p>Used by constraints: {usedInConstraints.join(", ")}</p>}
          </div>

          <Preview groupKey={selected} group={group} />

          <Button size="sm" variant="ghost" className="text-red-500" onClick={deleteGroup}>
            Delete option group
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Select or add an option group.</p>
      )}
    </div>
  );
}

function OptionsTable({ options, onChange }: { options: OptionDef[]; onChange: (o: OptionDef[]) => void }) {
  const update = (i: number, patch: Partial<OptionDef>) =>
    onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <Field label="Options">
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-1 text-[11px] text-muted-foreground px-1">
          <span>Label</span>
          <span>ID</span>
          <span>Default</span>
          <span />
          <span />
        </div>
        {options.map((o, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-1">
            <input
              className={inputClass}
              value={o.label}
              onChange={(e) => {
                // Keep the id in step with the label until it's been set by hand.
                const autoId = !o.id || o.id === toKey(o.label);
                update(i, autoId ? { label: e.target.value, id: toKey(e.target.value) } : { label: e.target.value });
              }}
            />
            <input className={`${inputClass} font-mono text-xs`} value={o.id} onChange={(e) => update(i, { id: typingKey(e.target.value) })} />
            <input
              type="checkbox"
              className="mx-3"
              checked={!!o.default}
              onChange={(e) => onChange(options.map((x, j) => ({ ...x, default: j === i && e.target.checked ? true : undefined })))}
            />
            <MoveButtons index={i} count={options.length} onMove={(f, t) => onChange(move(options, f, t))} />
            <button className="px-2 text-red-500 opacity-70 hover:opacity-100" onClick={() => onChange(options.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => onChange([...options, { id: "", label: "" }])}>
          + Add option
        </Button>
      </div>
    </Field>
  );
}

function Preview({ groupKey, group }: { groupKey: string; group: OptionGroupDef }) {
  const [value, setValue] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">Live preview</span>
      <div className="pointer-events-auto rounded-lg border border-dashed border-border p-2">
        <OptionGroup
          key={groupKey}
          title={group.label || "(no label)"}
          options={group.options?.filter((o) => o.id && o.label)}
          value={value}
          onChange={setValue}
          multiSelect={group.multi_select}
          selectedMulti={multi}
          onMultiChange={setMulti}
          allowOther={group.allow_other}
          type={group.type}
          placeholder={group.placeholder}
        />
      </div>
    </div>
  );
}
