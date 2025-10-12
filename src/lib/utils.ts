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

export function formatDeliverableType(type: string) {
  if (type === "CISUpload") return "CIS Upload";
  if (type === "TestProject") return "Test Project";
  if (type === "MarkingScheme") return "Marking Scheme";
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}
