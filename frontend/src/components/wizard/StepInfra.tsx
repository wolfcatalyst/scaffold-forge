"use client";

import OptionGroup from "./OptionGroup";
import type { ScaffoldConfig } from "@/lib/api";

interface Props {
  config: ScaffoldConfig;
  onChange: (config: ScaffoldConfig) => void;
}

export default function StepInfra({ config, onChange }: Props) {
  const updateStack = (field: string, value: string) => {
    onChange({
      ...config,
      stack: { ...config.stack, [field]: value },
    });
  };

  const dockerDisabled = config.stack.target === "electron" || config.stack.target === "mobile";

  return (
    <div className="space-y-4">
      <OptionGroup
        title="Docker"
        options={[
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ]}
        value={config.stack.docker as string}
        onChange={(v) => updateStack("docker", v)}
        disabled={dockerDisabled}
      />

      <OptionGroup
        title="CI/CD"
        options={[
          { id: "github_actions", label: "GitHub Actions" },
          { id: "none", label: "None" },
        ]}
        value={config.stack.cicd as string}
        onChange={(v) => updateStack("cicd", v)}
      />

      {config.stack.docker === "yes" && (
        <OptionGroup
          title="Reverse Proxy"
          options={[
            { id: "nginx", label: "Nginx" },
            { id: "caddy", label: "Caddy" },
            { id: "none", label: "None" },
          ]}
          value={config.stack.reverse_proxy as string}
          onChange={(v) => updateStack("reverse_proxy", v)}
        />
      )}

      <OptionGroup
        title="Runtime"
        options={[
          { id: "venv", label: "venv" },
          { id: "system_python", label: "System Python" },
          { id: "conda", label: "Conda" },
          { id: "docker_only", label: "Docker-only" },
        ]}
        value={config.stack.runtime as string}
        onChange={(v) => updateStack("runtime", v)}
      />
    </div>
  );
}
