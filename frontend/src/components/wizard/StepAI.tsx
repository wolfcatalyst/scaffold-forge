"use client";

import OptionGroup from "./OptionGroup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScaffoldConfig } from "@/lib/api";

interface Props {
  config: ScaffoldConfig;
  onChange: (config: ScaffoldConfig) => void;
}

export default function StepAI({ config, onChange }: Props) {
  const updateStack = (field: string, value: string) => {
    onChange({
      ...config,
      stack: { ...config.stack, [field]: value },
    });
  };

  return (
    <div className="space-y-4">
      <OptionGroup
        title="AI Integration"
        options={[
          { id: "none", label: "None" },
          { id: "single", label: "Single provider" },
          { id: "multi", label: "Multiple providers" },
        ]}
        value={config.stack.ai_integration as string}
        onChange={(v) => updateStack("ai_integration", v)}
      />

      {config.stack.ai_integration !== "none" && (
        <>
          <OptionGroup
            title="Primary AI Provider"
            options={[
              { id: "anthropic", label: "Anthropic Claude" },
              { id: "openai", label: "OpenAI" },
              { id: "ollama", label: "Local Ollama" },
              { id: "google", label: "Google Gemini" },
              { id: "custom", label: "Custom (OpenAI-compatible)" },
            ]}
            value={config.stack.ai_primary_provider as string}
            onChange={(v) => updateStack("ai_primary_provider", v)}
          />

          <OptionGroup
            title="AI Pattern"
            options={[
              { id: "response_agent", label: "Response Agent" },
              { id: "simple_completion", label: "Simple Completion" },
              { id: "chain", label: "Chain" },
              { id: "custom", label: "Custom" },
            ]}
            value={config.stack.ai_pattern as string}
            onChange={(v) => updateStack("ai_pattern", v)}
          />

          {config.stack.ai_integration === "multi" && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="text-sm">Multi-provider defaults (Wolf stack)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground font-mono">
{`AI_PRIMARY_PROVIDER=anthropic
AI_PRIMARY_MODEL=claude-sonnet-4-5
AI_FAST_PROVIDER=openai
AI_FAST_MODEL=gpt-4o-mini
AI_LOCAL_PROVIDER=ollama
AI_LOCAL_MODEL=llama3.2
AI_PATTERN=response_agent`}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
