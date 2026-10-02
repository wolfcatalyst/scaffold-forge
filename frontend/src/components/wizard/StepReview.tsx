"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScaffoldConfig, ConstraintResult, TreePreviewResponse } from "@/lib/api";
import { validateConfig, previewTree, generateScaffold, getAiPrompt } from "@/lib/api";
import { quickFix } from "@/lib/constraints";
import { severityStyles as severityColor } from "./OptionGroup";

interface Props {
  config: ScaffoldConfig;
  onChange: (config: ScaffoldConfig) => void;
}

export default function StepReview({ config, onChange }: Props) {
  const applyFix = (c: ConstraintResult) => {
    const fix = quickFix({ ...c, id: c.constraint_id, if: {} });
    if (!fix) return;
    const stackFix = Object.fromEntries(Object.entries(fix).filter(([k]) => k in config.stack));
    onChange({ ...config, stack: { ...config.stack, ...stackFix } });
  };

  const [constraints, setConstraints] = useState<ConstraintResult[]>([]);
  const [tree, setTree] = useState<TreePreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hasBlockers, setHasBlockers] = useState(false);
  const [promptStatus, setPromptStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([validateConfig(config), previewTree(config)])
      .then(([validation, treeData]) => {
        if (cancelled) return;
        setConstraints(validation.results);
        setHasBlockers(validation.has_blockers);
        setTree(treeData);
      })
      .catch(console.error)
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [config]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const blob = await generateScaffold(config);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${config.project_name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      const { prompt } = await getAiPrompt(config);
      try {
        await navigator.clipboard.writeText(prompt);
        setPromptStatus("Copied. Paste it into any AI assistant.");
      } catch {
        // Clipboard needs a secure context; fall back to a file.
        const url = URL.createObjectURL(new Blob([prompt], { type: "text/markdown" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `${config.project_name}-ai-review.md`;
        a.click();
        URL.revokeObjectURL(url);
        setPromptStatus("Clipboard unavailable, so the prompt was downloaded as a file.");
      }
    } catch (err) {
      console.error(err);
      setPromptStatus("Couldn't build the prompt.");
    }
    setTimeout(() => setPromptStatus(""), 4000);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Validating configuration...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Constraint Results */}
      {constraints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Constraint Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {constraints.map((c) => (
              <div
                key={c.constraint_id}
                className={`p-3 rounded-md border ${severityColor[c.severity]}`}
              >
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className={severityColor[c.severity]}>
                    {c.severity}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm">{c.message}</p>
                    {c.war_story && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-xs underline mt-1 opacity-70 hover:opacity-100">
                            War story
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm">
                          <p className="text-xs">{c.war_story}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {c.severity !== "info" && quickFix({ ...c, id: c.constraint_id, if: {} }) && (
                    <Button size="xs" variant="outline" onClick={() => applyFix(c)}>
                      Fix
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Config Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Project</span>
            <span>{config.project_name}</span>
            <span className="text-muted-foreground">Type</span>
            <span>{config.intent.project_type || "—"}</span>
            <span className="text-muted-foreground">Backend</span>
            <span>{config.stack.backend}</span>
            <span className="text-muted-foreground">Frontend</span>
            <span>{config.stack.frontend}</span>
            <span className="text-muted-foreground">Database</span>
            <span>{config.stack.database}</span>
            <span className="text-muted-foreground">Auth</span>
            <span>{config.stack.auth}</span>
            <span className="text-muted-foreground">Docker</span>
            <span>{config.stack.docker}</span>
            <span className="text-muted-foreground">AI</span>
            <span>
              {config.stack.ai_integration === "none"
                ? "none"
                : `${config.stack.ai_primary_provider} (${config.stack.ai_pattern})`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* File Tree Preview */}
      {tree && (
        <Card>
          <CardHeader>
            <CardTitle>
              Folder Tree Preview
              <span className="text-xs text-muted-foreground ml-2">
                ({tree.files.length} files)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <pre className="text-xs font-mono text-muted-foreground whitespace-pre">
                {tree.tree_display}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Generate Button */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleGenerate}
        disabled={hasBlockers || generating}
      >
        {generating
          ? "Generating..."
          : hasBlockers
            ? "Resolve blockers before generating"
            : "Generate Scaffold"}
      </Button>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleCopyPrompt}>
          Copy AI review prompt
        </Button>
        <span className="text-xs text-muted-foreground">
          {promptStatus || "Get a second opinion on this plan from any AI assistant."}
        </span>
      </div>
    </div>
  );
}
