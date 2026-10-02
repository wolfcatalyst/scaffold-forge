"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ScaffoldConfig } from "@/lib/api";

const PROJECT_TYPES = [
  { id: "prototype", label: "Prototype / proof of concept" },
  { id: "internal_tool", label: "Internal tool (single team, not public)" },
  { id: "production_service", label: "Production service / API" },
  { id: "saas", label: "SaaS product (multi-tenant, public)" },
  { id: "client_deliverable", label: "Client deliverable" },
  { id: "open_source", label: "Open source project" },
  { id: "desktop_app", label: "Desktop app (Electron)" },
  { id: "mobile_app", label: "Mobile app" },
];

const PROJECT_TYPE_TARGETS: Record<string, string> = {
  desktop_app: "electron",
  mobile_app: "mobile",
};

const USERS = [
  { id: "just_me", label: "Just me" },
  { id: "small_team", label: "Small team (< 10)" },
  { id: "organization", label: "Organization (10+)" },
  { id: "public", label: "General public / customers" },
];

const LIFESPANS = [
  { id: "throwaway", label: "Throwaway (days/weeks)" },
  { id: "medium_term", label: "Medium term (months)" },
  { id: "long_term", label: "Long term / maintained indefinitely" },
];

interface Props {
  config: ScaffoldConfig;
  onChange: (config: ScaffoldConfig) => void;
}

export default function StepIntent({ config, onChange }: Props) {
  const update = (field: string, value: string) => {
    const next = { ...config, intent: { ...config.intent, [field]: value } };
    // Keep the target environment in step with the kind of app being built.
    const target = field === "project_type" ? PROJECT_TYPE_TARGETS[value] : undefined;
    onChange(target ? { ...next, stack: { ...next.stack, target } } : next);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>What is this project?</CardTitle>
          <CardDescription>This drives smart defaults for every option that follows.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={config.intent.project_type} onValueChange={(v) => update("project_type", v)}>
            {PROJECT_TYPES.map((t) => (
              <label key={t.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
                <RadioGroupItem value={t.id} />
                <span>{t.label}</span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who uses it?</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={config.intent.users} onValueChange={(v) => update("users", v)}>
            {USERS.map((t) => (
              <label key={t.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
                <RadioGroupItem value={t.id} />
                <span>{t.label}</span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expected lifespan?</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={config.intent.lifespan} onValueChange={(v) => update("lifespan", v)}>
            {LIFESPANS.map((t) => (
              <label key={t.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
                <RadioGroupItem value={t.id} />
                <span>{t.label}</span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project Name</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="text"
            value={config.project_name}
            onChange={(e) => onChange({ ...config, project_name: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="my-project"
          />
        </CardContent>
      </Card>
    </div>
  );
}
