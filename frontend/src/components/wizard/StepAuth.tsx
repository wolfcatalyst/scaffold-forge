"use client";

import OptionGroup from "./OptionGroup";
import type { ScaffoldConfig } from "@/lib/api";

interface Props {
  config: ScaffoldConfig;
  onChange: (config: ScaffoldConfig) => void;
}

export default function StepAuth({ config, onChange }: Props) {
  const updateStack = (field: string, value: string) => {
    onChange({
      ...config,
      stack: { ...config.stack, [field]: value },
    });
  };

  return (
    <div className="space-y-4">
      <OptionGroup
        title="Authentication"
        options={[
          { id: "none", label: "None" },
          { id: "jwt", label: "JWT" },
          { id: "oauth2", label: "OAuth2 / Social" },
          { id: "api_key", label: "API Key" },
          { id: "authentik", label: "Authentik SSO" },
          { id: "magic_link", label: "Magic Link" },
        ]}
        value={config.stack.auth as string}
        onChange={(v) => updateStack("auth", v)}
      />

      <OptionGroup
        title="Multi-user"
        options={[
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ]}
        value={config.stack.multiuser as string}
        onChange={(v) => updateStack("multiuser", v)}
      />
    </div>
  );
}
