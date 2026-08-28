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

export const DAYS_OF_WEEK = [
  { day: 1, name: "Lunes", short: "Lun" },
  { day: 2, name: "Martes", short: "Mar" },
  { day: 3, name: "Miércoles", short: "Mié" },
  { day: 4, name: "Jueves", short: "Jue" },
  { day: 5, name: "Viernes", short: "Vie" },
  { day: 6, name: "Sábado", short: "Sáb" },
] as const;
