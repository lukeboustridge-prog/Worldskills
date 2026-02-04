"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const INPUT_FORMAT = "yyyy-MM-dd";
const DISPLAY_FORMAT = "dd MMM yyyy";

type DatePickerValue = string | null | undefined;

interface DatePickerProps {
  id: string;
  name: string;
  value?: DatePickerValue;
  defaultValue?: DatePickerValue;
  onChange?: (value: string | null) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

function parseValue(value: DatePickerValue) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? parseISO(value) : value;
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

export function DatePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
  disabled = false,
  required = false,
  placeholder = "Select a date",
  className
}: DatePickerProps) {
  const isControlled = value !== undefined;
  const initialDate = React.useMemo(() => parseValue(isControlled ? value : defaultValue), [
    isControlled,
    value,
    defaultValue
  ]);
  const [internalDate, setInternalDate] = React.useState<Date | null>(initialDate);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (isControlled) {
      setInternalDate(parseValue(value));
    }
  }, [isControlled, value]);

  const selectedDate = isControlled ? parseValue(value) ?? null : internalDate;

  const commitChange = React.useCallback(
    (next: Date | null) => {
      if (!isControlled) {
        setInternalDate(next);
      }
      onChange?.(next ? format(next, INPUT_FORMAT) : null);
    },
    [isControlled, onChange]
  );

  const displayLabel = selectedDate ? format(selectedDate, DISPLAY_FORMAT) : placeholder;
  const inputValue = selectedDate ? format(selectedDate, INPUT_FORMAT) : "";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            {displayLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(date) => {
              commitChange(date ?? null);
              if (date) {
                setOpen(false);
              }
            }}
            initialFocus
          />
          <div className="flex items-center justify-between border-t bg-muted px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => commitChange(null)}
              disabled={!selectedDate}
            >
              Clear
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={inputValue} required={required} disabled={disabled} />
    </>
  );
}
