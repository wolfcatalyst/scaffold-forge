"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ScaffoldConfig } from "@/lib/api";

const QUESTIONS = [
  {
    field: "survive_restart",
    question: "Does any data need to survive a server restart?",
    no: "No — results are consumed immediately and discarded",
    yes: "Yes — users/data need to persist",
  },
  {
    field: "return_to_previous",
    question: "Do users come back to find previous work?",
    no: "No — each session is independent",
    yes: "Yes — history/state must be retrievable",
  },
  {
    field: "search_query",
    question: "Does anything need to be searched or queried later?",
    no: "No — data flows through and exits",
    yes: "Yes — needs indexing/querying",
  },
  {
    field: "user_data_isolation",
    question: "Is there a meaningful difference between users' data?",
    no: "No — single-user or shared state",
    yes: "Yes — per-user data isolation required",
  },
];

interface Props {
  config: ScaffoldConfig;
  onChange: (config: ScaffoldConfig) => void;
}

export default function StepDataLifecycle({ config, onChange }: Props) {
  const update = (field: string, value: string) => {
    onChange({
      ...config,
      data_lifecycle: { ...config.data_lifecycle, [field]: value },
    });
  };

  const allNo = Object.values(config.data_lifecycle).every((v) => v === "no");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Lifecycle</CardTitle>
          <CardDescription>
            Most projects don&apos;t need a database. Let&apos;s find out if yours does.
          </CardDescription>
        </CardHeader>
      </Card>

      {QUESTIONS.map((q) => (
        <Card key={q.field}>
          <CardHeader>
            <CardTitle className="text-base">{q.question}</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={(config.data_lifecycle as Record<string, string>)[q.field]}
              onValueChange={(v) => update(q.field, v)}
            >
              <label className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
                <RadioGroupItem value="no" />
                <span>{q.no}</span>
              </label>
              <label className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
                <RadioGroupItem value="yes" />
                <span>{q.yes}</span>
              </label>
            </RadioGroup>
          </CardContent>
        </Card>
      ))}

      {allNo && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-400">
              No persistent storage needed. Database options will be skipped. If you need config/settings to persist, JSON files will be used.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
