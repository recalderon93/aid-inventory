import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function capitalizeWords(text: string) {
  if (!text.trim()) return text;
  return text
    .toLowerCase()
    .replace(/(^|[\s\-/])(\S)/g, (_, sep, char) => `${sep}${char.toUpperCase()}`);
}

export function normalizeText(text: string) {
  return text.trim().toLowerCase();
}

export function profileDisplayName(profile?: { name: string } | null) {
  return profile?.name?.trim() || null;
}
