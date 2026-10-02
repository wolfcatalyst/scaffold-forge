"use client";

import OptionGroup from "./OptionGroup";
import type { ScaffoldConfig } from "@/lib/api";

interface Props {
  config: ScaffoldConfig;
  onChange: (config: ScaffoldConfig) => void;
}

export default function StepTooling({ config, onChange }: Props) {
  const updateStack = (field: string, value: string) => {
    onChange({
      ...config,
      stack: { ...config.stack, [field]: value },
    });
  };

  return (
    <div className="space-y-4">
      <OptionGroup
        title="Git"
        options={[
          { id: "init", label: "git init" },
          { id: "pre_commit", label: "git init + pre-commit hooks" },
        ]}
        value={config.stack.git as string}
        onChange={(v) => updateStack("git", v)}
      />

      <OptionGroup
        title="Build Tool"
        options={[
          { id: "makefile", label: "Makefile" },
          { id: "none", label: "None" },
        ]}
        value={config.stack.build as string}
        onChange={(v) => updateStack("build", v)}
      />

      <OptionGroup
        title="IDE Config"
        options={[
          { id: "devcontainer", label: "Dev Container" },
          { id: "none", label: "None" },
        ]}
        value={config.stack.ide as string}
        onChange={(v) => updateStack("ide", v)}
      />

      <OptionGroup
        title="Linting"
        options={[
          { id: "ruff", label: "Ruff (Python)" },
          { id: "eslint", label: "ESLint (JS)" },
          { id: "both", label: "Both" },
          { id: "none", label: "None" },
        ]}
        value={config.stack.linting as string}
        onChange={(v) => updateStack("linting", v)}
      />
    </div>
  );
}
