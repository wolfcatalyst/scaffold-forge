"use client";

import OptionGroup from "./OptionGroup";
import type { ScaffoldConfig } from "@/lib/api";

interface Props {
  config: ScaffoldConfig;
  onChange: (config: ScaffoldConfig) => void;
}

export default function StepStack({ config, onChange }: Props) {
  const updateStack = (field: string, value: string | string[]) => {
    onChange({
      ...config,
      stack: { ...config.stack, [field]: value },
    });
  };

  return (
    <div className="space-y-4">
      <OptionGroup
        title="Target Environment"
        options={[
          { id: "linux", label: "Linux" },
          { id: "windows", label: "Windows" },
          { id: "windows_server", label: "Windows Server" },
          { id: "macos", label: "macOS" },
          { id: "electron", label: "Electron (Desktop)" },
          { id: "mobile", label: "Mobile" },
        ]}
        value={config.stack.target as string}
        onChange={(v) => updateStack("target", v)}
      />

      <OptionGroup
        title="Backend Framework"
        options={[
          { id: "fastapi", label: "FastAPI" },
          { id: "express", label: "Express" },
          { id: "flask", label: "Flask" },
          { id: "none", label: "None (frontend-only)" },
        ]}
        value={config.stack.backend as string}
        onChange={(v) => updateStack("backend", v)}
      />

      <OptionGroup
        title="Frontend Framework"
        options={[
          { id: "react", label: "React" },
          { id: "streamlit", label: "Streamlit" },
          { id: "vue", label: "Vue" },
          { id: "none", label: "None (API-only)" },
        ]}
        value={config.stack.frontend as string}
        onChange={(v) => updateStack("frontend", v)}
      />

      {config.stack.frontend === "react" && (
        <>
          <OptionGroup
            title="Styling"
            options={[
              { id: "tailwind", label: "Tailwind CSS" },
              { id: "plain_css", label: "Plain CSS" },
              { id: "bootstrap", label: "Bootstrap" },
            ]}
            value={config.stack.styling as string}
            onChange={(v) => updateStack("styling", v)}
          />
          <OptionGroup
            title="Component Library"
            options={[
              { id: "shadcn", label: "shadcn/ui" },
              { id: "none", label: "None" },
            ]}
            value={config.stack.component_library as string}
            onChange={(v) => updateStack("component_library", v)}
          />
        </>
      )}

      <OptionGroup
        title="Theme"
        options={[
          { id: "dark", label: "Dark mode" },
          { id: "light", label: "Light mode" },
          { id: "both", label: "Both (toggle)" },
        ]}
        value={config.stack.theme as string}
        onChange={(v) => updateStack("theme", v)}
      />

      <OptionGroup
        title="Frontend Features"
        options={[
          { id: "ai_chat_panel", label: "AI chat panel" },
          { id: "auth_ui", label: "Auth UI" },
          { id: "dashboard_layout", label: "Dashboard layout" },
          { id: "data_tables", label: "Data tables" },
          { id: "file_upload", label: "File upload" },
          { id: "settings_page", label: "Settings/profile page" },
        ]}
        value=""
        onChange={() => {}}
        multiSelect
        selectedMulti={config.stack.frontend_features as string[]}
        onMultiChange={(v) => updateStack("frontend_features", v)}
      />
    </div>
  );
}
