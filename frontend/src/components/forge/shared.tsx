"use client";

import { Button } from "@/components/ui/button";

export const inputClass =
  "w-full px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 space-y-1">
      {errors.map((e) => (
        <p key={e}>{e}</p>
      ))}
    </div>
  );
}

export function SaveBar({
  dirty,
  customized,
  saving,
  onSave,
  onDiscard,
  onReset,
}: {
  dirty: boolean;
  customized: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onReset: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
      <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
        {saving ? "Saving..." : "Save changes"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDiscard} disabled={!dirty || saving}>
        Discard
      </Button>
      <span className="text-xs text-muted-foreground">
        {dirty ? "Unsaved changes" : customized ? "Customized" : "Using built-in defaults"}
      </span>
      {customized && (
        <Button size="sm" variant="outline" className="ml-auto" onClick={onReset} disabled={saving}>
          Reset to defaults
        </Button>
      )}
    </div>
  );
}

export function MoveButtons({
  index,
  count,
  onMove,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <span className="flex gap-0.5">
      <button
        className="px-1.5 text-xs opacity-60 hover:opacity-100 disabled:opacity-20"
        disabled={index === 0}
        onClick={(e) => { e.stopPropagation(); onMove(index, index - 1); }}
        title="Move up"
      >
        ▲
      </button>
      <button
        className="px-1.5 text-xs opacity-60 hover:opacity-100 disabled:opacity-20"
        disabled={index === count - 1}
        onClick={(e) => { e.stopPropagation(); onMove(index, index + 1); }}
        title="Move down"
      >
        ▼
      </button>
    </span>
  );
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** HTML5 drag-to-reorder props for a list row. */
export function dragProps(index: number, onMove: (from: number, to: number) => void) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      if (!Number.isNaN(from) && from !== index) onMove(from, index);
    },
  };
}

/** Sanitize an ID while the user is typing (keeps trailing separators). */
export const typingKey = (text: string, separator: "_" | "-" = "_") =>
  text.toLowerCase().replace(separator === "_" ? /[^a-z0-9_]+/g : /[^a-z0-9-]+/g, separator);

/** Derive a clean key from free text, e.g. a label. */
export const toKey = (text: string) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "_$1");

export function useDirty<T>(draft: T, saved: T) {
  return JSON.stringify(draft) !== JSON.stringify(saved);
}
