"use client";

import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  checkPort,
  electronAPI,
  getRuntimeInfo,
  savePorts,
  saveSettings,
  type AppSettings,
  type RuntimeInfo,
} from "@/lib/api";

interface Props {
  settings: AppSettings;
  onSettingsChange: (update: Partial<AppSettings>) => void;
  onOpenEditor: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-5 space-y-3 bg-card">
      <h4 className="font-medium">{title}</h4>
      {children}
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; swatch?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors ${
              value === o.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
            }`}
          >
            {o.swatch && <span className="size-3 rounded-full" style={{ background: o.swatch }} />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const ACCENTS: { id: AppSettings["accent"]; label: string; swatch: string }[] = [
  { id: "neutral", label: "Neutral", swatch: "oklch(0.6 0 0)" },
  { id: "blue", label: "Blue", swatch: "oklch(0.55 0.2 262)" },
  { id: "green", label: "Green", swatch: "oklch(0.56 0.15 150)" },
  { id: "violet", label: "Violet", swatch: "oklch(0.55 0.22 293)" },
  { id: "orange", label: "Orange", swatch: "oklch(0.62 0.18 45)" },
  { id: "rose", label: "Rose", swatch: "oklch(0.58 0.21 16)" },
];

function PortsSection({ runtime, onRuntime }: { runtime: RuntimeInfo; onRuntime: (r: RuntimeInfo) => void }) {
  const [backend, setBackend] = useState(String(runtime.preferred_ports.backend));
  const [frontend, setFrontend] = useState(String(runtime.preferred_ports.frontend));
  const [availability, setAvailability] = useState<Record<string, boolean | undefined>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ports = [Number(backend), Number(frontend)].filter((p) => Number.isInteger(p) && p > 0);
    const timer = setTimeout(() => {
      Promise.all(ports.map((p) => checkPort(p)))
        .then((results) => setAvailability(Object.fromEntries(results.map((r) => [r.port, r.available]))))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [backend, frontend]);

  if (runtime.mode === "desktop") {
    return (
      <p className="text-sm text-muted-foreground">
        The desktop app picks a free local port automatically every time it starts, so there is nothing to configure.
      </p>
    );
  }
  if (runtime.mode === "docker") {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed">
        Running in Docker. Ports are set by <code>BACKEND_PORT</code> and <code>FRONTEND_PORT</code> in the
        project&apos;s <code>.env</code> file on the host. Change them there, then run{" "}
        <code>docker compose up</code> again.
      </p>
    );
  }

  const status = (value: string, current: number | null) => {
    const port = Number(value);
    if (port === current) return <span className="text-xs text-muted-foreground">in use by this app</span>;
    const free = availability[port];
    if (free === undefined) return null;
    return free ? (
      <span className="text-xs text-green-600 dark:text-green-400">available</span>
    ) : (
      <span className="text-xs text-orange-600 dark:text-orange-400">in use (will auto-increment)</span>
    );
  };

  const save = async () => {
    try {
      onRuntime(await savePorts(Number(backend), Number(frontend)));
      setMessage("Saved to .env. Restart start-forge.bat (or make dev) to use the new ports.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const row = (label: string, value: string, set: (v: string) => void, current: number | null) => (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => set(e.target.value)}
        className="w-28 px-2 py-1 text-sm bg-background border border-input rounded-md"
      />
      {status(value, current)}
      {current !== null && Number(value) !== current && (
        <span className="text-xs text-muted-foreground">currently {current}</span>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Preferred ports for running from source. If a port is taken, the next free one is used.
      </p>
      {row("Backend", backend, setBackend, runtime.current_ports.backend)}
      {row("Frontend", frontend, setFrontend, runtime.current_ports.frontend)}
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save}>Save ports</Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}

function TemplatesFolder({ runtime, onRuntime }: { runtime: RuntimeInfo; onRuntime: (r: RuntimeInfo) => void }) {
  const [path, setPath] = useState(runtime.custom_templates_dir);
  const [message, setMessage] = useState("");
  const desktop = electronAPI();
  const isDefault = runtime.custom_templates_dir === runtime.default_custom_templates_dir;

  const apply = async (value: string) => {
    try {
      await saveSettings({ custom_templates_dir: value });
      const next = await getRuntimeInfo();
      onRuntime(next);
      setPath(next.custom_templates_dir);
      setMessage(value ? "Saved. Templates are now read from this folder." : "Back to the default folder.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const browse = async () => {
    const picked = await desktop?.pickFolder(path);
    if (picked) {
      setPath(picked);
      apply(picked);
    }
  };

  const reveal = async () => {
    if (desktop) {
      const error = await desktop.openFolder(runtime.custom_templates_dir);
      if (error) setMessage(error);
      return;
    }
    try {
      await navigator.clipboard.writeText(runtime.custom_templates_dir);
      setMessage("Path copied.");
    } catch {
      // clipboard blocked
    }
  };

  if (!runtime.custom_templates_editable) {
    return (
      <div className="space-y-1">
        <code className="block truncate text-xs px-2 py-1.5 rounded bg-muted">{runtime.custom_templates_dir}</code>
        <p className="text-xs text-muted-foreground">
          In Docker this is <code>backend/data/custom_templates</code> in the project folder on your machine.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 min-w-0 px-2 py-1.5 text-xs font-mono bg-background border border-input rounded-md"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply(path === runtime.default_custom_templates_dir ? "" : path)}
        />
        {desktop && <Button size="sm" variant="outline" onClick={browse}>Browse…</Button>}
        <Button size="sm" variant="outline" onClick={reveal}>{desktop ? "Open folder" : "Copy path"}</Button>
      </div>
      <div className="flex items-center gap-2">
        {path !== runtime.custom_templates_dir && (
          <Button size="sm" onClick={() => apply(path === runtime.default_custom_templates_dir ? "" : path)}>
            Save location
          </Button>
        )}
        {!isDefault && (
          <Button size="sm" variant="ghost" onClick={() => apply("")}>Use default</Button>
        )}
        <span className="text-xs text-muted-foreground">
          {message || (isDefault ? "Default location. Created automatically." : "Custom location.")}
        </span>
      </div>
    </div>
  );
}

export default function StepSettings({ settings, onSettingsChange, onOpenEditor }: Props) {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);

  useEffect(() => {
    getRuntimeInfo().then(setRuntime).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Application preferences and configuration management.</p>

      <Separator />

      <Section title="Forge Configuration">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Edit wizard steps, option groups, and constraints without touching JSON files. Changes are saved to your
          data folder, so app updates never overwrite them, and you can reset to the built-in defaults at any time.
        </p>
        <Button size="sm" onClick={onOpenEditor}>Open configuration editor</Button>
      </Section>

      <Section title="Appearance">
        <Choice
          label="Theme"
          value={settings.theme}
          options={[
            { id: "dark", label: "Dark" },
            { id: "light", label: "Light" },
            { id: "system", label: "System" },
          ]}
          onChange={(theme) => onSettingsChange({ theme })}
        />
        <Choice label="Accent" value={settings.accent} options={ACCENTS} onChange={(accent) => onSettingsChange({ accent })} />
        <Choice
          label="Sidebar"
          value={settings.sidebar_width}
          options={[
            { id: "narrow", label: "Narrow" },
            { id: "normal", label: "Normal" },
            { id: "wide", label: "Wide" },
          ]}
          onChange={(sidebar_width) => onSettingsChange({ sidebar_width })}
        />
        <Choice
          label="Density"
          value={settings.compact ? "compact" : "comfortable"}
          options={[
            { id: "comfortable", label: "Comfortable" },
            { id: "compact", label: "Compact" },
          ]}
          onChange={(v) => onSettingsChange({ compact: v === "compact" })}
        />
      </Section>

      <Section title="Port Configuration">
        {runtime ? (
          <PortsSection runtime={runtime} onRuntime={setRuntime} />
        ) : (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
      </Section>

      <Section title="Custom Templates">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Override any generated file by dropping a Jinja2 template into this folder, using the same path as the
          generated file plus <code>.j2</code>. For example, <code>README.md.j2</code> or{" "}
          <code>backend/app/main.py.j2</code>. Templates receive the full scaffold config.
        </p>
        {runtime && <TemplatesFolder runtime={runtime} onRuntime={setRuntime} />}
      </Section>
    </div>
  );
}
