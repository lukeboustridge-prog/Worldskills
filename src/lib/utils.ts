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

