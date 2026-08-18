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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { useAgentCron } from "@/features/agent";

/** The subset of the cron hook this dialog needs — created jobs must land in the
 * page's own hook instance, so the page passes its `createJob` down. */
type CreateJob = ReturnType<typeof useAgentCron>["createJob"];

type Frequency = "daily" | "weekly" | "hourly" | "everyHours" | "everyMinutes";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "hourly", label: "Hourly" },
  { value: "everyHours", label: "Every N hours" },
  { value: "everyMinutes", label: "Every N minutes" },
];

const WEEKDAYS: { value: string; label: string }[] = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

/**
 * Turn the builder selections into a standard 5-field cron string — the inverse
 * of `describeCron`, so the value it produces always renders back to friendly
 * English in the table and preview.
 */
function buildCron(
  frequency: Frequency,
  time: string,
  dayOfWeek: string,
  everyHours: number,
  everyMinutes: number,
): string {
  const [h, m] = time.split(":");
  const hour = Number(h) || 0;
  const minute = Number(m) || 0;
  switch (frequency) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly":
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case "hourly":
      return "0 */1 * * *";
    case "everyHours":
      return `0 */${Math.max(1, everyHours)} * * *`;
    case "everyMinutes":
      return `*/${Math.max(1, everyMinutes)} * * * *`;
  }
}

const DEFAULTS = {
  frequency: "daily" as Frequency,
  time: "09:00",
  dayOfWeek: "1",
  everyHours: 4,
  everyMinutes: 15,
};

export function CreateScheduleDialog({ createJob }: { createJob: CreateJob }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [instruction, setInstruction] = useState("");
  const [frequency, setFrequency] = useState<Frequency>(DEFAULTS.frequency);
  const [time, setTime] = useState(DEFAULTS.time);
  const [dayOfWeek, setDayOfWeek] = useState(DEFAULTS.dayOfWeek);
  const [everyHours, setEveryHours] = useState(DEFAULTS.everyHours);
  const [everyMinutes, setEveryMinutes] = useState(DEFAULTS.everyMinutes);
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const cron = buildCron(frequency, time, dayOfWeek, everyHours, everyMinutes);
  const canSubmit = name.trim().length > 0 && instruction.trim().length > 0;

  function reset() {
    setName("");
    setInstruction("");
    setFrequency(DEFAULTS.frequency);
    setTime(DEFAULTS.time);
    setDayOfWeek(DEFAULTS.dayOfWeek);
    setEveryHours(DEFAULTS.everyHours);
    setEveryMinutes(DEFAULTS.everyMinutes);
    setActive(true);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await createJob({
        name: name.trim(),
        instruction: instruction.trim(),
        schedule: cron,
        enabled: active,
      });
      toast.success(`Scheduled task "${name.trim()}" created`);
      handleOpenChange(false);
    } catch {
      toast.error("Couldn't create the scheduled task. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="action" className="rounded-full">
          <Plus className="size-4" />
          New scheduled task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New scheduled task</DialogTitle>
            <DialogDescription>
              Run an instruction on a recurring schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-name">Name</Label>
              <Input
                id="schedule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Daily standup summary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-instruction">Instruction</Label>
              <Textarea
                id="schedule-instruction"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Summarise yesterday's activity and post it to the team channel."
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-frequency">Schedule</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={frequency}
                  onValueChange={(v) => setFrequency(v as Frequency)}
                >
                  <SelectTrigger id="schedule-frequency" className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {frequency === "weekly" && (
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger
                      aria-label="Day of week"
                      className="w-[150px]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {(frequency === "daily" || frequency === "weekly") && (
                  <Input
                    aria-label="Time of day"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-[130px]"
                  />
                )}

                {frequency === "everyHours" && (
                  <Input
                    aria-label="Interval in hours"
                    type="number"
                    min={1}
                    max={23}
                    value={everyHours}
                    onChange={(e) =>
                      setEveryHours(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-[90px]"
                  />
                )}

                {frequency === "everyMinutes" && (
                  <Input
                    aria-label="Interval in minutes"
                    type="number"
                    min={1}
                    max={59}
                    value={everyMinutes}
                    onChange={(e) =>
                      setEveryMinutes(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-[90px]"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="schedule-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Start running on this schedule right away.
                </p>
              </div>
              <Switch
                id="schedule-active"
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </div>

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
              disabled={!canSubmit || submitting}
            >
              {submitting ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
