import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SCHEDULE_BLOCKS = [
  { block: 1, label: "Bloque 1", startTime: "07:00", endTime: "08:30" },
  { block: 2, label: "Bloque 2", startTime: "08:30", endTime: "10:00" },
  { block: 3, label: "Bloque 3", startTime: "10:00", endTime: "11:30" },
  { block: 4, label: "Bloque 4", startTime: "11:30", endTime: "13:00" },
] as const;

// Jornada escolar oficial: Lunes a Viernes
export const DAYS_OF_WEEK = [
  { day: 1, name: "Lunes", short: "Lun" },
  { day: 2, name: "Martes", short: "Mar" },
  { day: 3, name: "Miércoles", short: "Mié" },
  { day: 4, name: "Jueves", short: "Jue" },
  { day: 5, name: "Viernes", short: "Vie" },
] as const;

export const SUBJECT_COLORS = [
  "#6366F1", // Indigo
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#06B6D4", // Cyan
  "#14B8A6", // Teal
  "#E11D48", // Rose
] as const;
