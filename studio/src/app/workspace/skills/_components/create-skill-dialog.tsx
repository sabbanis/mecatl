"use client";

import { Plus, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validSkillName } from "@/lib/controller-security.mjs";
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

/**
 * Authors a brand-new skill: a name under the shared grammar plus a SKILL.md
 * body — typed into the seeded template or read client-side from an uploaded
 * .md file (the create POST carries the content; there is no upload
 * endpoint). Modeled on the edit dialog's shell; creation always restarts the
 * daemon (a new skill is invisible until its startup snapshot is rebuilt), so
 * the description warns first and a controller refusal renders verbatim
 * in-dialog.
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
      setName("");
      setBody(skillTemplate);
      setFileName(null);
      setRefusal(null);
    }
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
        <DialogContent className="flex max-h-[90vh] flex-col max-[499px]:top-0 max-[499px]:left-0 max-[499px]:h-dvh max-[499px]:max-h-none max-[499px]:w-screen max-[499px]:max-w-none max-[499px]:translate-x-0 max-[499px]:translate-y-0 max-[499px]:rounded-none max-[499px]:border-0 sm:max-w-3xl">
          <DialogHeader className="text-left">
            <DialogTitle>New skill</DialogTitle>
            <DialogDescription>
              Creating a skill restarts the daemon — in-flight runs and session
              ids die with it.
            </DialogDescription>
          </DialogHeader>

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
            <input
              ref={fileInput}
              type="file"
              accept=".md,text/markdown"
              className="sr-only"
              aria-label="Upload a SKILL.md file"
              onChange={handleFile}
            />
            {fileName && (
              <span className="truncate font-mono text-xs text-muted-foreground">
                {fileName}
              </span>
            )}
          </div>

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
              disabled={!canSubmit}
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating…" : "Create skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
