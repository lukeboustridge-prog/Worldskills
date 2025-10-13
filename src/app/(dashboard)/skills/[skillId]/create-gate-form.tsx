"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createGateAction } from "./actions";

type ScheduleType = "calendar" | "cmonth";

interface CreateGateFormProps {
  skillId: string;
}

export function CreateGateForm({ skillId }: CreateGateFormProps) {
  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("calendar");
  const [dueDate, setDueDate] = useState("");
  const [offsetMonths, setOffsetMonths] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a gate name before saving.");
      return;
    }

    if (scheduleType === "calendar" && !dueDate) {
      setError("Choose a calendar date for the gate.");
      return;
    }

    if (scheduleType === "cmonth" && offsetMonths.trim().length === 0) {
      setError("Enter the number of months before C1.");
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.append("skillId", skillId);
    formData.append("name", name.trim());
    formData.append("scheduleType", scheduleType);

    if (scheduleType === "calendar") {
      formData.append("dueDate", dueDate);
    } else {
      formData.append("offsetMonths", offsetMonths.trim());
    }

    startTransition(async () => {
      try {
        await createGateAction(formData);
        setName("");
        if (scheduleType === "calendar") {
          setDueDate("");
        } else {
          setOffsetMonths("1");
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to create gate");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="skillId" value={skillId} />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="gate-name">Gate name</Label>
        <Input
          id="gate-name"
          name="name"
          placeholder="Validation workshop"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          disabled={isPending}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gate-schedule">Schedule type</Label>
        <select
          id="gate-schedule"
          name="scheduleType"
          value={scheduleType}
          onChange={(event) => {
            setScheduleType(event.target.value as ScheduleType);
            setError(null);
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          disabled={isPending}
        >
          <option value="calendar">Calendar date</option>
          <option value="cmonth">C-month offset from C1</option>
        </select>
      </div>
      {scheduleType === "calendar" ? (
        <div className="space-y-2">
          <Label htmlFor="gate-date">Due date</Label>
          <Input
            id="gate-date"
            name="dueDate"
            type="date"
            value={dueDate}
            onChange={(event) => {
              setDueDate(event.target.value);
              setError(null);
            }}
            disabled={isPending}
            required
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="gate-offset">Months before C1</Label>
          <Input
            id="gate-offset"
            name="offsetMonths"
            type="number"
            min={0}
            step={1}
            value={offsetMonths}
            onChange={(event) => {
              setOffsetMonths(event.target.value);
              setError(null);
            }}
            disabled={isPending}
            required
          />
        </div>
      )}
      {error ? (
        <p className="md:col-span-2 text-sm text-destructive">{error}</p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create gate"}
        </Button>
      </div>
    </form>
  );
}
