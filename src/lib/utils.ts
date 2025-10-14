import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDeliverableState(state: string) {
  return state
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bCIS\b/, "CIS");
}

export function normaliseFileName(fileName: string) {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return "document";
  }

  const lastDot = trimmed.lastIndexOf(".");
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const extension = lastDot > 0 ? trimmed.slice(lastDot + 1) : "";

  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const safeExtension = extension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^-+|-+$/g, "");

  const fallbackBase = safeBase.length > 0 ? safeBase : "document";
  return safeExtension ? `${fallbackBase}.${safeExtension}` : fallbackBase;
}

