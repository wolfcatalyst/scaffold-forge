export class ApiError extends Error {
  constructor(public status: number, public details: string[]) {
    super(details.join("\n") || `API error: ${status}`);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let details: string[] = [];
    try {
      const body = await res.json();
      details = Array.isArray(body.detail) ? body.detail.map(String) : body.detail ? [String(body.detail)] : [];
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, details);
  }
  return res.json();
}

export async function getOptions() {
  return request<OptionsResponse>("/api/options");
}

// Forge Configuration editor
export async function getForgeConfig() {
  return request<ForgeConfigState>("/api/config");
}

export async function saveForgeConfig(updates: Partial<Record<ConfigName, unknown>>) {
  return request<ForgeConfigState>("/api/config", { method: "PUT", body: JSON.stringify(updates) });
}

export async function resetForgeConfig(name?: ConfigName) {
  return request<ForgeConfigState>(name ? `/api/config/${name}` : "/api/config", { method: "DELETE" });
}

export async function exportForgeConfig() {
  return request<Record<string, unknown>>("/api/config/export");
}

export async function importForgeConfig(pack: unknown) {
  return request<ForgeConfigState>("/api/config/import", { method: "POST", body: JSON.stringify(pack) });
}

// Settings
export async function getSettings() {
  return request<AppSettings>("/api/settings");
}

export async function saveSettings(update: Partial<AppSettings>) {
  return request<AppSettings>("/api/settings", { method: "PUT", body: JSON.stringify(update) });
}

export async function getRuntimeInfo() {
  return request<RuntimeInfo>("/api/settings/runtime");
}

export async function checkPort(port: number) {
  return request<{ port: number; available: boolean }>(`/api/settings/ports/check?port=${port}`);
}

export async function savePorts(backend_port: number, frontend_port: number) {
  return request<RuntimeInfo>("/api/settings/ports", {
    method: "PUT",
    body: JSON.stringify({ backend_port, frontend_port }),
  });
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function validateConfig(config: ScaffoldConfig) {
  return request<ValidationResponse>("/api/validate", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function previewTree(config: ScaffoldConfig) {
  return request<TreePreviewResponse>("/api/scaffold/preview", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function getAiPrompt(config: ScaffoldConfig) {
  return request<{ prompt: string }>("/api/scaffold/prompt", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function generateScaffold(config: ScaffoldConfig): Promise<Blob> {
  const res = await fetch(`/api/scaffold/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Generation failed: ${res.status}`);
  return res.blob();
}

export async function getTemplates() {
  return request<TemplateEntry[]>("/api/templates/");
}

export async function loadTemplate(id: string) {
  return request<TemplateEntry>(`/api/templates/${id}`);
}

export async function saveTemplate(name: string, config: Record<string, unknown>) {
  return request<TemplateEntry>("/api/templates/", {
    method: "POST",
    body: JSON.stringify({ name, config }),
  });
}

export async function deleteTemplate(id: string) {
  return request<{ deleted: boolean }>(`/api/templates/${id}`, {
    method: "DELETE",
  });
}

export async function importTemplate(file: File): Promise<TemplateEntry> {
  const text = await file.text();
  const data = JSON.parse(text);
  return saveTemplate(data.name || file.name.replace(".json", ""), data.config || data);
}

export function exportTemplate(template: TemplateEntry) {
  downloadJson(template, `${template.name.toLowerCase().replace(/\s+/g, "-")}.json`);
}

// Types
export interface ScaffoldConfig {
  project_name: string;
  intent: {
    project_type: string;
    users: string;
    lifespan: string;
  };
  data_lifecycle: {
    survive_restart: string;
    return_to_previous: string;
    search_query: string;
    user_data_isolation: string;
  };
  stack: Record<string, string | string[]>;
}

export interface ConstraintResult {
  constraint_id: string;
  severity: "hard" | "error" | "warn" | "info";
  message: string;
  war_story?: string;
  then: Record<string, unknown>;
}

export interface ValidationResponse {
  valid: boolean;
  has_blockers: boolean;
  results: ConstraintResult[];
}

export interface TreePreviewResponse {
  files: string[];
  tree_display: string;
}

export interface TemplateEntry {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

export interface OptionDef {
  id: string;
  label: string;
  default?: boolean;
}

export interface OptionGroupDef {
  label: string;
  multi_select?: boolean;
  allow_other?: boolean;
  type?: string;
  placeholder?: string;
  options?: OptionDef[];
}

export interface StepDef {
  id: string;
  label: string;
  type: "custom" | "options";
  description?: string;
  option_groups?: string[];
  skip_when?: Record<string, unknown>;
}

export type ConditionValue = string | string[] | { not: string | string[] };

export interface ConstraintDef {
  id: string;
  if: Record<string, ConditionValue>;
  severity: ConstraintResult["severity"];
  message: string;
  war_story?: string;
  then?: Record<string, unknown>;
}

export interface OptionsFile {
  intent: Record<string, unknown>;
  data_lifecycle: Record<string, unknown>;
  stack: Record<string, OptionGroupDef>;
}

export interface OptionsResponse {
  options: OptionsFile;
  constraints: ConstraintDef[];
  steps: StepDef[];
}

export type ConfigName = "options" | "steps" | "constraints";

export interface ForgeConfigState {
  options: OptionsFile;
  steps: StepDef[];
  constraints: ConstraintDef[];
  customized: Record<ConfigName, boolean>;
  known_fields: string[];
}

export interface AppSettings {
  theme: "dark" | "light" | "system";
  accent: "neutral" | "blue" | "green" | "violet" | "orange" | "rose";
  compact: boolean;
  sidebar_width: "narrow" | "normal" | "wide";
  custom_templates_dir: string;
}

export interface RuntimeInfo {
  mode: "dev" | "docker" | "desktop";
  ports_editable: boolean;
  preferred_ports: { backend: number; frontend: number };
  current_ports: { backend: number | null; frontend: number | null };
  data_dir: string;
  custom_templates_dir: string;
  default_custom_templates_dir: string;
  custom_templates_editable: boolean;
}

/** Exposed by electron/preload.js in the desktop app only. */
export interface ElectronAPI {
  isElectron: true;
  platform: string;
  pickFolder: (defaultPath?: string) => Promise<string | null>;
  openFolder: (folder: string) => Promise<string>;
}

export function electronAPI(): ElectronAPI | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
}
