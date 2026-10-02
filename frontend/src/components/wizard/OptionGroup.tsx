"use client";

import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConstraintDef, OptionDef as Option } from "@/lib/api";
import { quickFix, type OptionStatus } from "@/lib/constraints";

export const severityStyles: Record<string, string> = {
  hard: "bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/30",
  error: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  warn: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  info: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
};

const statusLabel: Record<string, string> = { hard: "blocked", error: "conflict", warn: "caution", info: "note" };

function StatusBadge({ status }: { status?: OptionStatus | null }) {
  if (!status) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`ml-auto shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${severityStyles[status.severity]}`}
        >
          {statusLabel[status.severity]}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        {status.messages.map((m) => (
          <p key={m} className="text-xs">{m}</p>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

function GroupAlerts({ alerts, onFix }: { alerts?: ConstraintDef[]; onFix?: (c: ConstraintDef) => void }) {
  if (!alerts?.length) return null;
  return (
    <div className="space-y-2 mb-3">
      {alerts.map((c) => (
        <div key={c.id} className={`flex items-start gap-2 p-2 rounded-md border text-xs ${severityStyles[c.severity]}`}>
          <span className="flex-1">{c.message}</span>
          {onFix && quickFix(c) && (
            <button onClick={() => onFix(c)} className="shrink-0 underline opacity-80 hover:opacity-100">
              Fix
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

interface Props {
  title: string;
  options?: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  multiSelect?: boolean;
  selectedMulti?: string[];
  onMultiChange?: (values: string[]) => void;
  allowOther?: boolean;
  type?: string;
  placeholder?: string;
  optionStatus?: Record<string, OptionStatus | null>;
  alerts?: ConstraintDef[];
  onFix?: (constraint: ConstraintDef) => void;
}

export default function OptionGroup({
  title,
  options = [],
  value,
  onChange,
  disabled,
  multiSelect,
  selectedMulti,
  onMultiChange,
  allowOther,
  type,
  placeholder,
  optionStatus = {},
  alerts,
  onFix,
}: Props) {
  const [otherText, setOtherText] = useState("");
  const blocked = (id: string, selected: boolean) => optionStatus[id]?.severity === "hard" && !selected;

  // Textarea mode — just a free-text box, no options
  if (type === "textarea") {
    return (
      <Card className={disabled ? "opacity-50" : ""}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Type here..."}
            disabled={disabled}
            rows={4}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </CardContent>
      </Card>
    );
  }

  // Multi-select with checkboxes
  if (multiSelect && onMultiChange) {
    const knownIds = options.map((o) => o.id);
    const customValues = (selectedMulti || []).filter((v) => !knownIds.includes(v));

    const handleAddOther = () => {
      const trimmed = otherText.trim();
      if (trimmed && !selectedMulti?.includes(trimmed)) {
        onMultiChange([...(selectedMulti || []), trimmed]);
        setOtherText("");
      }
    };

    return (
      <Card className={disabled ? "opacity-50" : ""}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupAlerts alerts={alerts} onFix={onFix} />
          <div className="space-y-1">
            {options.map((opt) => {
              const checked = selectedMulti?.includes(opt.id) ?? false;
              const isBlocked = blocked(opt.id, checked);
              return (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-2 rounded-md ${isBlocked ? "opacity-50 cursor-not-allowed" : "hover:bg-accent cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onMultiChange([...(selectedMulti || []), opt.id]);
                    } else {
                      onMultiChange((selectedMulti || []).filter((v) => v !== opt.id));
                    }
                  }}
                  disabled={disabled || isBlocked}
                  className="h-4 w-4 rounded border-input"
                />
                <span>{opt.label}</span>
                <StatusBadge status={optionStatus[opt.id]} />
              </label>
              );
            })}

            {/* Custom values already added */}
            {customValues.map((cv) => (
              <label
                key={cv}
                className="flex items-center gap-3 p-2 rounded-md bg-accent/50"
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => {
                    onMultiChange((selectedMulti || []).filter((v) => v !== cv));
                  }}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="italic">{cv}</span>
              </label>
            ))}

            {/* Add other input */}
            {allowOther && (
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOther())}
                  placeholder="Other..."
                  disabled={disabled}
                  className="flex-1 px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={handleAddOther}
                  disabled={disabled || !otherText.trim()}
                  className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Single-select with radio buttons
  const isOtherValue = value && !options.some((o) => o.id === value);

  return (
    <Card className={disabled ? "opacity-50" : ""}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <GroupAlerts alerts={alerts} onFix={onFix} />
        <RadioGroup
          value={isOtherValue ? "__other__" : value}
          onValueChange={(v) => {
            if (v === "__other__") {
              onChange(otherText || "custom");
            } else {
              onChange(v);
              setOtherText("");
            }
          }}
          disabled={disabled}
        >
          {options.map((opt) => {
            const isBlocked = blocked(opt.id, opt.id === value);
            return (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-2 rounded-md ${isBlocked ? "opacity-50 cursor-not-allowed" : "hover:bg-accent cursor-pointer"}`}
              >
                <RadioGroupItem value={opt.id} disabled={isBlocked} />
                <span>{opt.label}</span>
                <StatusBadge status={optionStatus[opt.id]} />
              </label>
            );
          })}

          {allowOther && (
            <label className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
              <RadioGroupItem value="__other__" />
              <span>Other:</span>
              <input
                type="text"
                value={isOtherValue ? value : otherText}
                onChange={(e) => {
                  setOtherText(e.target.value);
                  if (isOtherValue || value === "__other__") {
                    onChange(e.target.value);
                  }
                }}
                onFocus={() => {
                  if (!isOtherValue) {
                    onChange(otherText || "custom");
                  }
                }}
                placeholder="Specify..."
                disabled={disabled}
                className="flex-1 px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          )}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
