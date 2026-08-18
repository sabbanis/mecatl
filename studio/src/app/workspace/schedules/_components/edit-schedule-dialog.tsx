"use client";

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
} from "@/components/ui/dialog";
import {
  type ScheduleCarriedSpec,
  type ScheduleRow,
  type ScheduleSpecDraft,
  scheduleDraftFromRow,
} from "@/lib/protocol";
import {
  draftFromForm,
  formFromDraft,
  ScheduleFormFields,
  type ScheduleFormValue,
  scheduleFormProblem,
} from "./schedule-form";

/**
 * Edits an existing schedule. The form is seeded from the stored spec and the
 * save carries the row's `carried` fields verbatim: PUT replaces the whole
 * spec, so anything not re-sent (a CLI-set model selector, misfire policy,
 * fire timeout) would be silently deleted. The name is locked — the PUT
 * targets the stored name, so a rename would address a different spec.
 */
export function EditScheduleDialog({
  row,
  updateFromDraft,
  onClose,
}: {
  row: ScheduleRow;
  updateFromDraft: (
    draft: ScheduleSpecDraft,
    carried: ScheduleCarriedSpec,
  ) => Promise<void>;
  onClose: () => void;
}) {
  // The stored draft is captured once on mount: it seeds the form and supplies
  // the fields the form has no controls for (profile, workspace, limits).
  const [storedDraft] = useState(() => scheduleDraftFromRow(row));
  const [value, setValue] = useState<ScheduleFormValue>(() =>
    formFromDraft(storedDraft),
  );
  const [refusal, setRefusal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const problem = scheduleFormProblem(value);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (problem || submitting) return;
    setSubmitting(true);
    setRefusal(null);
    try {
      await updateFromDraft(draftFromForm(value, storedDraft), row.carried);
      toast.success(`Scheduled task "${row.name}" updated`);
      onClose();
    } catch (caught) {
      setRefusal(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit {row.name}</DialogTitle>
            <DialogDescription>
              Changes replace the stored spec; fields this form does not show
              are preserved as-is.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <ScheduleFormFields
              value={value}
              onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
              nameLocked
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
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="action"
              className="rounded-full"
              disabled={problem !== null || submitting}
            >
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
