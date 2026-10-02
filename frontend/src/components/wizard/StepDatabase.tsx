"use client";

import OptionGroup from "./OptionGroup";
import { Card, CardContent } from "@/components/ui/card";
import type { ScaffoldConfig } from "@/lib/api";

interface Props {
  config: ScaffoldConfig;
  onChange: (config: ScaffoldConfig) => void;
}

export default function StepDatabase({ config, onChange }: Props) {
  const allNo = Object.values(config.data_lifecycle).every((v) => v === "no");

  const updateStack = (field: string, value: string | string[]) => {
    onChange({
      ...config,
      stack: { ...config.stack, [field]: value },
    });
  };

  if (allNo) {
    return (
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-400">
            Based on your data lifecycle answers, no database is needed. This step is skipped.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <OptionGroup
        title="Database"
        options={[
          { id: "none", label: "None" },
          { id: "json_files", label: "JSON files" },
          { id: "sqlite", label: "SQLite" },
          { id: "postgresql", label: "PostgreSQL" },
          { id: "mysql", label: "MySQL" },
          { id: "mongodb", label: "MongoDB" },
        ]}
        value={config.stack.database as string}
        onChange={(v) => updateStack("database", v)}
      />

      <OptionGroup
        title="Database Add-ons"
        options={[{ id: "redis", label: "Redis (cache/queue)" }]}
        value=""
        onChange={() => {}}
        multiSelect
        selectedMulti={config.stack.database_addons as string[]}
        onMultiChange={(v) => updateStack("database_addons", v)}
      />

      {(config.stack.database === "postgresql" ||
        config.stack.database === "sqlite" ||
        config.stack.database === "mysql") && (
        <OptionGroup
          title="ORM"
          options={[
            { id: "sqlalchemy", label: "SQLAlchemy" },
            { id: "tortoise", label: "Tortoise ORM" },
            { id: "none", label: "None" },
          ]}
          value={config.stack.orm as string}
          onChange={(v) => updateStack("orm", v)}
        />
      )}
    </div>
  );
}
