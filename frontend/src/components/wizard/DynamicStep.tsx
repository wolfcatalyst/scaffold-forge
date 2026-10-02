"use client";

import OptionGroup from "./OptionGroup";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import type { ConstraintDef, OptionGroupDef, ScaffoldConfig, StepDef } from "@/lib/api";
import { activeForGroup, evaluate, hiddenGroups, previewOption, quickFix } from "@/lib/constraints";

interface Props {
  stepDef: StepDef & { option_groups: string[] };
  stackOptions: Record<string, OptionGroupDef>;
  constraints: ConstraintDef[];
  config: ScaffoldConfig;
  onChange: (config: ScaffoldConfig) => void;
}

export default function DynamicStep({ stepDef, stackOptions, constraints, config, onChange }: Props) {
  // Check skip conditions
  if (stepDef.skip_when?.data_lifecycle_all_no) {
    const allNo = Object.values(config.data_lifecycle).every((v) => v === "no");
    if (allNo) {
      return (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-500 dark:text-blue-400">
              Based on your data lifecycle answers, this section is skipped.
            </p>
          </CardContent>
        </Card>
      );
    }
  }

  const updateStack = (field: string, value: string | string[]) => {
    onChange({
      ...config,
      stack: { ...config.stack, [field]: value },
    });
  };

  const applyFix = (constraint: ConstraintDef) => {
    const fix = quickFix(constraint);
    if (!fix) return;
    const stackFix = Object.fromEntries(Object.entries(fix).filter(([k]) => k in stackOptions));
    onChange({ ...config, stack: { ...config.stack, ...stackFix } });
  };

  const active = evaluate(constraints, config);
  const hidden = hiddenGroups(active);
  const groups = stepDef.option_groups
    .filter((key) => !hidden.has(key))
    .map((key) => ({ key, def: stackOptions[key] }))
    .filter(({ def }) => def !== undefined);

  return (
    <div className="space-y-4">
      {stepDef.description && (
        <Card>
          <CardContent className="pt-6">
            <CardDescription>{stepDef.description}</CardDescription>
          </CardContent>
        </Card>
      )}

      {groups.map(({ key, def }) => {
        const optionStatus = Object.fromEntries(
          (def.options ?? []).map((o) => [o.id, previewOption(constraints, config, key, o.id, !!def.multi_select)]),
        );
        const alerts = activeForGroup(active, key).filter((c) => c.severity !== "info");
        return (
          <OptionGroup
            key={key}
            title={def.label}
            options={def.options}
            value={def.multi_select ? "" : (config.stack[key] as string) ?? ""}
            onChange={(v) => updateStack(key, v)}
            multiSelect={def.multi_select}
            selectedMulti={def.multi_select ? (config.stack[key] as string[]) ?? [] : undefined}
            onMultiChange={def.multi_select ? (v) => updateStack(key, v) : undefined}
            allowOther={def.allow_other}
            type={def.type}
            placeholder={def.placeholder}
            optionStatus={optionStatus}
            alerts={alerts}
            onFix={applyFix}
          />
        );
      })}
    </div>
  );
}
