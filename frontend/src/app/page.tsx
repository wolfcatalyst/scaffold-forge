"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { defaultConfig } from "@/lib/defaults";
import {
  getOptions,
  getSettings,
  saveSettings,
  getTemplates,
  loadTemplate,
  saveTemplate,
  deleteTemplate,
  exportTemplate,
  importTemplate,
  type AppSettings,
  type ConstraintDef,
  type OptionGroupDef,
  type ScaffoldConfig,
  type StepDef,
  type TemplateEntry,
} from "@/lib/api";
import { applyAppearance, cachedAppearance, SIDEBAR_CLASS } from "@/lib/appearance";
import StepIntent from "@/components/wizard/StepIntent";
import StepDataLifecycle from "@/components/wizard/StepDataLifecycle";
import StepReview from "@/components/wizard/StepReview";
import DynamicStep from "@/components/wizard/DynamicStep";
import StepSettings from "@/components/wizard/StepSettings";
import ForgeConfigEditor from "@/components/forge/ForgeConfigEditor";

type View = "wizard" | "settings" | "editor";

export default function Home() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<ScaffoldConfig>({ ...defaultConfig });
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [stackOptions, setStackOptions] = useState<Record<string, OptionGroupDef>>({});
  const [constraints, setConstraints] = useState<ConstraintDef[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("wizard");
  const [settings, setSettings] = useState<AppSettings>(cachedAppearance);
  const importRef = useRef<HTMLInputElement>(null);
  const showSettings = view !== "wizard";

  const refreshTemplates = () => {
    getTemplates().then(setTemplates).catch(() => {});
  };

  const refreshOptions = () =>
    getOptions()
      .then((data) => {
        setSteps(data.steps ?? []);
        setStackOptions(data.options?.stack ?? {});
        setConstraints(data.constraints ?? []);
        setStep((s) => Math.min(s, Math.max((data.steps?.length ?? 1) - 1, 0)));
      })
      .catch(console.error);

  useEffect(() => {
    refreshTemplates();
    refreshOptions().finally(() => setLoaded(true));
    getSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    applyAppearance(settings);
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance(settings);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings]);

  const updateSettings = (update: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...update }));
    saveSettings(update).then(setSettings).catch(console.error);
  };

  const currentStep = steps[step];
  const canGoNext = step < steps.length - 1;
  const canGoPrev = step > 0;

  const handleLoadTemplate = async (id: string) => {
    try {
      const t = await loadTemplate(id);
      const c = t.config as unknown as Partial<ScaffoldConfig>;
      // Templates may omit fields (the built-ins have no project_name).
      setConfig({
        ...defaultConfig,
        ...c,
        intent: { ...defaultConfig.intent, ...c.intent },
        data_lifecycle: { ...defaultConfig.data_lifecycle, ...c.data_lifecycle },
        stack: { ...defaultConfig.stack, ...c.stack },
      });
      setShowTemplates(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) return;
    try {
      await saveTemplate(saveName.trim(), config as unknown as Record<string, unknown>);
      setSaveName("");
      setShowSaveInput(false);
      refreshTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTemplate(id);
      refreshTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportTemplate = (t: TemplateEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    exportTemplate(t);
  };

  const handleImportTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importTemplate(file);
      refreshTemplates();
    } catch (err) {
      console.error(err);
    }
    if (importRef.current) importRef.current.value = "";
  };

  const renderStep = () => {
    if (!currentStep) return null;

    // Custom steps with unique logic
    if (currentStep.type === "custom") {
      switch (currentStep.id) {
        case "intent":
          return <StepIntent config={config} onChange={setConfig} />;
        case "data":
          return <StepDataLifecycle config={config} onChange={setConfig} />;
        case "review":
          return <StepReview config={config} onChange={setConfig} />;
        default:
          return <p className="text-muted-foreground">Custom step &quot;{currentStep.id}&quot; not implemented yet.</p>;
      }
    }

    // Dynamic options steps — rendered from backend config
    if (currentStep.type === "options" && currentStep.option_groups) {
      return (
        <DynamicStep
          stepDef={currentStep as StepDef & { option_groups: string[] }}
          stackOptions={stackOptions}
          constraints={constraints}
          config={config}
          onChange={setConfig}
        />
      );
    }

    return null;
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      {/* Sidebar: fits the window, scrolls on its own if it has to */}
      <div className={`${SIDEBAR_CLASS[settings.sidebar_width]} shrink-0 border-r border-border bg-card p-4 flex flex-col overflow-y-auto`}>
        <h1 className="text-lg font-bold mb-1">Scaffold Forge</h1>
        <p className="text-xs text-muted-foreground mb-4">Wolf Edition</p>
        <Separator className="mb-4" />

        <nav className="space-y-1 flex-1">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setStep(i); setView("wizard"); }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                i === step && !showSettings
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              <span className="mr-2 text-xs opacity-60">{i + 1}.</span>
              {s.label}
            </button>
          ))}
        </nav>

        <Separator className="my-4" />

        {/* Template Management */}
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setShowTemplates(!showTemplates);
              setShowSaveInput(false);
            }}
          >
            {showTemplates ? "Hide Templates" : "Templates"}
          </Button>

          {showTemplates && (
            <>
              {templates.length > 0 && (
                <ScrollArea className="h-48">
                  <div className="space-y-0.5">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        className="group flex items-center gap-1 px-2 py-1.5 rounded text-xs hover:bg-accent cursor-pointer"
                        onClick={() => handleLoadTemplate(t.id)}
                      >
                        <span className="flex-1 truncate">{t.name}</span>
                        <button
                          onClick={(e) => handleExportTemplate(t, e)}
                          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 px-1"
                          title="Export"
                        >
                          {"↓"}
                        </button>
                        <button
                          onClick={(e) => handleDeleteTemplate(t.id, e)}
                          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-red-400 px-1"
                          title="Delete"
                        >
                          {"×"}
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {showSaveInput ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
                    placeholder="Template name..."
                    className="flex-1 px-2 py-1 text-xs bg-background border border-input rounded"
                    autoFocus
                  />
                  <Button size="sm" variant="secondary" className="text-xs px-2 h-7" onClick={handleSaveTemplate}>
                    Save
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowSaveInput(true)}
                >
                  Save Current Config
                </Button>
              )}

              <input
                ref={importRef}
                type="file"
                accept=".json"
                onChange={handleImportTemplate}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => importRef.current?.click()}
              >
                Import from JSON
              </Button>
            </>
          )}
        </div>

        <Separator className="my-4" />

        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setConfig({ ...defaultConfig })}
          >
            Reset Config
          </Button>
          <Button
            variant={showSettings ? "secondary" : "ghost"}
            size="sm"
            className="w-full"
            onClick={() => setView(showSettings ? "wizard" : "settings")}
          >
            Settings
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {view === "editor" ? "Forge Configuration" : showSettings ? "Settings" : currentStep?.label}
            </h2>
            {!showSettings && (
              <p className="text-xs text-muted-foreground">
                Step {step + 1} of {steps.length}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {config.project_name !== "my-project" && (
              <Badge variant="secondary">{config.project_name}</Badge>
            )}
            {config.intent.project_type && (
              <Badge variant="outline">{config.intent.project_type}</Badge>
            )}
          </div>
        </div>

        {/* Step Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className={`${view === "editor" ? "max-w-4xl" : "max-w-2xl"} mx-auto p-6`}>
            {view === "editor" ? (
              <ForgeConfigEditor onSaved={refreshOptions} onClose={() => setView("settings")} />
            ) : view === "settings" ? (
              <StepSettings settings={settings} onSettingsChange={updateSettings} onOpenEditor={() => setView("editor")} />
            ) : (
              renderStep()
            )}
          </div>
        </ScrollArea>

        {/* Footer Navigation */}
        {!showSettings && (
          <div className="border-t border-border px-6 py-3 flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={!canGoPrev}
            >
              Previous
            </Button>
            {canGoNext && (
              <Button onClick={() => setStep(step + 1)}>Next</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
