"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ScheduleSpecDraft } from "@/lib/protocol";
import {
  draftFromForm,
  emptyScheduleForm,
  ScheduleFormFields,
  type ScheduleFormValue,
  scheduleFormProblem,
} from "./schedule-form";

/**
 * Authors a full ScheduleSpecDraft and hands it to the page's own hook
 * instance, so the new row lands in the table the user is looking at. Daemon
 * refusals (frequency floor, bad cron, duplicate name) render verbatim inside
 * the dialog — the daemon's words are the validation.
 */
export function CreateScheduleDialog({
  createFromDraft,
}: {
  createFromDraft: (draft: ScheduleSpecDraft) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<ScheduleFormValue>(emptyScheduleForm);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const problem = scheduleFormProblem(value);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setValue(emptyScheduleForm());
      setRefusal(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (problem || submitting) return;
    setSubmitting(true);
    setRefusal(null);
    try {
      await createFromDraft(draftFromForm(value));
      toast.success(`Scheduled task "${value.name.trim()}" created`);
      handleOpenChange(false);
    } catch (caught) {
      setRefusal(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="action" className="rounded-full">
          <Plus className="size-4" />
          <span className="max-[499px]:hidden">New scheduled task</span>
          <span className="min-[500px]:hidden">New</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New scheduled task</DialogTitle>
            <DialogDescription>
              Run a prompt on a schedule, or once at a set time.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <ScheduleFormFields
              value={value}
              onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
            />
          </div>

          {refusal && (
            <p className="mb-3 whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {refusal}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="action"
              className="rounded-full"
              disabled={problem !== null || submitting}
            >
              {submitting ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
