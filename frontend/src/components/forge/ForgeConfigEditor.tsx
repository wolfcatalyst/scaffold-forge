"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  downloadJson,
  exportForgeConfig,
  getForgeConfig,
  importForgeConfig,
  resetForgeConfig,
  saveForgeConfig,
  type ConfigName,
  type ForgeConfigState,
  type OptionGroupDef,
} from "@/lib/api";
import StepsEditor from "./StepsEditor";
import OptionGroupsEditor from "./OptionGroupsEditor";
import ConstraintsEditor from "./ConstraintsEditor";
import { ErrorList, SaveBar } from "./shared";

type Draft = Pick<ForgeConfigState, "options" | "steps" | "constraints">;
const NAMES: ConfigName[] = ["options", "steps", "constraints"];

interface Props {
  onSaved: () => void;
  onClose: () => void;
}

export default function ForgeConfigEditor({ onSaved, onClose }: Props) {
  const [state, setState] = useState<ForgeConfigState | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const adopt = (s: ForgeConfigState) => {
    setState(s);
    setDraft({ options: s.options, steps: s.steps, constraints: s.constraints });
    setErrors([]);
  };

  useEffect(() => {
    getForgeConfig().then(adopt).catch((e) => setErrors([(e as Error).message]));
  }, []);

  if (!state || !draft) {
    return errors.length ? <ErrorList errors={errors} /> : <p className="text-muted-foreground">Loading...</p>;
  }

  const changed = NAMES.filter((n) => JSON.stringify(draft[n]) !== JSON.stringify(state[n]));
  const customizedAny = NAMES.some((n) => state.customized[n]);

  const run = async (action: () => Promise<ForgeConfigState>, success: string) => {
    setSaving(true);
    setNotice("");
    try {
      adopt(await action());
      setNotice(success);
      onSaved();
    } catch (e) {
      setErrors(e instanceof ApiError && e.details.length ? e.details : [(e as Error).message]);
    } finally {
      setSaving(false);
    }
  };

  const save = () =>
    run(() => saveForgeConfig(Object.fromEntries(changed.map((n) => [n, draft[n]]))), "Saved. The wizard now uses your configuration.");

  const setGroups = (stack: Record<string, OptionGroupDef>) => {
    // Drop references to deleted groups from steps in the same draft.
    const steps = draft.steps.map((s) =>
      s.option_groups ? { ...s, option_groups: s.option_groups.filter((g) => g in stack) } : s,
    );
    setDraft({ ...draft, options: { ...draft.options, stack }, steps });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (importRef.current) importRef.current.value = "";
    if (!file) return;
    let pack: unknown;
    try {
      pack = JSON.parse(await file.text());
    } catch {
      setErrors(["That file isn't valid JSON."]);
      return;
    }
    run(() => importForgeConfig(pack), `Imported ${file.name}.`);
  };

  const knownFields = [
    ...state.known_fields.filter((f) => !(f in state.options.stack)),
    ...Object.keys(draft.options.stack),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Customize the wizard. Nothing changes until you save.
        </p>
        <Button size="sm" variant="ghost" onClick={onClose}>← Back to settings</Button>
      </div>

      <ErrorList errors={errors} />
      {notice && !errors.length && <p className="text-xs text-green-600 dark:text-green-400">{notice}</p>}

      <Tabs defaultValue="steps">
        <TabsList>
          <TabsTrigger value="steps">Steps{changed.includes("steps") ? " •" : ""}</TabsTrigger>
          <TabsTrigger value="groups">Option Groups{changed.includes("options") ? " •" : ""}</TabsTrigger>
          <TabsTrigger value="constraints">Constraints{changed.includes("constraints") ? " •" : ""}</TabsTrigger>
          <TabsTrigger value="pack">Import / Export</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="pt-4">
          <StepsEditor steps={draft.steps} groups={draft.options.stack} onChange={(steps) => setDraft({ ...draft, steps })} />
        </TabsContent>

        <TabsContent value="groups" className="pt-4">
          <OptionGroupsEditor
            groups={draft.options.stack}
            steps={draft.steps}
            constraints={draft.constraints}
            onChange={setGroups}
          />
        </TabsContent>

        <TabsContent value="constraints" className="pt-4">
          <ConstraintsEditor
            constraints={draft.constraints}
            options={draft.options}
            knownFields={knownFields}
            onChange={(constraints) => setDraft({ ...draft, constraints })}
          />
        </TabsContent>

        <TabsContent value="pack" className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            A configuration pack is a single JSON file holding your steps, option groups and constraints. Share it
            or keep it as a backup. Importing a pack replaces your current configuration.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={async () => downloadJson(await exportForgeConfig(), "scaffold-forge-config.json")}>
              Export pack
            </Button>
            <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>Import pack</Button>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
          <div className="text-sm space-y-1">
            {NAMES.map((n) => (
              <div key={n} className="flex items-center gap-3">
                <span className="w-24 text-muted-foreground">{n}.json</span>
                <span className="text-xs">{state.customized[n] ? "customized" : "built-in default"}</span>
                {state.customized[n] && (
                  <button
                    className="text-xs underline opacity-70 hover:opacity-100"
                    onClick={() => run(() => resetForgeConfig(n), `Reset ${n} to the built-in default.`)}
                  >
                    reset
                  </button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <SaveBar
        dirty={changed.length > 0}
        customized={customizedAny}
        saving={saving}
        onSave={save}
        onDiscard={() => adopt(state)}
        onReset={() => {
          if (confirm("Reset all steps, option groups and constraints to the built-in defaults?")) {
            run(() => resetForgeConfig(), "Reset everything to the built-in defaults.");
          }
        }}
      />
    </div>
  );
}
