"use client";

import { PenLine, Plus, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validSkillName } from "@/lib/controller-security.mjs";
import { cn } from "@/lib/utils";
import { deriveSkillName } from "./skill-name";

/** The daemon's activation-name grammar, as helper text under an invalid name. */
const nameRule =
  "Lowercase letters, digits, hyphens, and underscores — max 64 characters, starting with a letter or digit.";

/** A just-enough SKILL.md: the frontmatter the inventory reads (name +
 *  description) and a stub for the instructions the model loads on demand. */
const skillTemplate = `---
name: my-skill
description: One line telling the agent when to reach for this skill.
---

# Instructions

Describe, step by step, what the agent should do when it loads this skill.
`;

/** One selectable card on the chooser step — the Create-project idiom:
 *  icon top-left, radio dot top-right, title + description below. */
function ChoiceCard({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: typeof Upload;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-6 rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary ring-1 ring-primary"
          : "hover:border-muted-foreground/40",
      )}
    >
      <span className="flex items-start justify-between">
        <Icon className="size-5 text-muted-foreground" />
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 items-center justify-center rounded-full border",
            selected ? "border-primary" : "border-muted-foreground/50",
          )}
        >
          {selected && <span className="size-2 rounded-full bg-primary" />}
        </span>
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

/**
 * Authors a brand-new skill in two steps: a chooser (upload a SKILL.md, or
 * write one by hand), then the editor — a name under the shared grammar plus
 * the SKILL.md body. Upload reads the file client-side (the create POST
 * carries the content; there is no upload endpoint) and manual mode hides the
 * upload button entirely. A controller refusal renders verbatim in-dialog.
 */
export function CreateSkillDialog({
  create,
  onCreated,
}: {
  create: (name: string, body: string) => Promise<void>;
  /** Called after a successful create — the page navigates to the new skill. */
  onCreated: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "edit">("choose");
  const [mode, setMode] = useState<"upload" | "manual">("upload");
  const [name, setName] = useState("");
  const [body, setBody] = useState(skillTemplate);
  const [fileName, setFileName] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const nameFieldId = useId();

  const nameValid = validSkillName(name);
  const canSubmit = nameValid && body.trim().length > 0 && !creating;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Fresh form every open — a cancelled draft never haunts the next one.
      setStep("choose");
      setMode("upload");
      setName("");
      setBody(skillTemplate);
      setFileName(null);
      setRefusal(null);
    }
  }

  function handleNext() {
    setStep("edit");
    // Chain the picker off the Next click (a user gesture) so upload mode
    // goes straight to choosing a file; cancelling still lands in the editor.
    if (mode === "upload") fileInput.current?.click();
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setBody(content);
      setFileName(file.name);
      // A typed name wins; an empty field adopts the file's suggestion
      // (frontmatter name:, else the filename slug, sanitized to the grammar).
      setName((current) => current || deriveSkillName(file.name, content));
    };
    reader.readAsText(file);
    // Same file re-chosen later must fire change again.
    event.target.value = "";
  }

  async function handleCreate() {
    if (!canSubmit) return;
    setCreating(true);
    setRefusal(null);
    try {
      await create(name, body);
      setOpen(false);
      onCreated(name);
    } catch (caught) {
      setRefusal(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="action"
        className="rounded-full"
        onClick={() => handleOpenChange(true)}
      >
        <Plus className="size-4" />
        <span className="max-[499px]:hidden">New skill</span>
        <span className="min-[500px]:hidden">New</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[90vh] flex-col max-[499px]:top-0 max-[499px]:left-0 max-[499px]:h-dvh max-[499px]:max-h-none max-[499px]:w-screen max-[499px]:max-w-none max-[499px]:translate-x-0 max-[499px]:translate-y-0 max-[499px]:rounded-none max-[499px]:border-0",
            step === "choose" ? "sm:max-w-lg" : "sm:max-w-3xl",
          )}
        >
          <DialogHeader className="text-left">
            <DialogTitle>New skill</DialogTitle>
          </DialogHeader>

          {/* Mounted on both steps (inside the dialog, where pointer events
              live) so the Next click can open the picker before the editor
              step has rendered. */}
          <input
            ref={fileInput}
            type="file"
            accept=".md,text/markdown"
            className="sr-only"
            aria-label="Upload a SKILL.md file"
            onChange={handleFile}
          />

          {step === "choose" ? (
            <>
              <div className="grid grid-cols-2 gap-3 max-[499px]:grid-cols-1">
                <ChoiceCard
                  icon={Upload}
                  title="Upload"
                  description="Import an existing SKILL.md file."
                  selected={mode === "upload"}
                  onSelect={() => setMode("upload")}
                />
                <ChoiceCard
                  icon={PenLine}
                  title="Create manually"
                  description="Write the skill from scratch."
                  selected={mode === "manual"}
                  onSelect={() => setMode("manual")}
                />
              </div>

              <DialogFooter className="flex-row justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="action"
                  className="rounded-full"
                  onClick={handleNext}
                >
                  Next
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={nameFieldId}>Name</Label>
                <Input
                  id={nameFieldId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="my-skill"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={name.length > 0 && !nameValid}
                  className="font-mono"
                />
                {!nameValid && (
                  <p className="text-xs text-muted-foreground">{nameRule}</p>
                )}
              </div>

              {mode === "upload" && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload className="size-4" />
                    Upload SKILL.md
                  </Button>
                  {fileName && (
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {fileName}
                    </span>
                  )}
                </div>
              )}

              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                spellCheck={false}
                aria-label="SKILL.md content"
                className="min-h-[35vh] flex-1 resize-none overflow-y-auto font-mono text-xs leading-relaxed"
              />

              {refusal && (
                <p className="whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {refusal}
                </p>
              )}

              <DialogFooter className="flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="mr-auto rounded-full"
                  onClick={() => setStep("choose")}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="action"
                  className="rounded-full"
                  disabled={!canSubmit}
                  onClick={() => void handleCreate()}
                >
                  {creating ? "Creating…" : "Create skill"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
