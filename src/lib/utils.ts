import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 4 Clases diarias oficiales de 90 minutos
export const SCHEDULE_BLOCKS = [
  { block: 1, label: "Clase 1", startTime: "07:00", endTime: "08:30", fullStart: "07:00:00", fullEnd: "08:30:00" },
  { block: 2, label: "Clase 2", startTime: "08:30", endTime: "10:00", fullStart: "08:30:00", fullEnd: "10:00:00" },
  { block: 3, label: "Clase 3", startTime: "10:00", endTime: "11:30", fullStart: "10:00:00", fullEnd: "11:30:00" },
  { block: 4, label: "Clase 4", startTime: "11:30", endTime: "13:00", fullStart: "11:30:00", fullEnd: "13:00:00" },
] as const;

// Jornada escolar oficial: Lunes a Viernes
export const DAYS_OF_WEEK = [
  { day: 1, name: "Lunes", short: "Lun" },
  { day: 2, name: "Martes", short: "Mar" },
  { day: 3, name: "Miércoles", short: "Mié" },
  { day: 4, name: "Jueves", short: "Jue" },
  { day: 5, name: "Viernes", short: "Vie" },
] as const;

// Paleta de colores básicos y de alto contraste (incluyendo blanco)
export const SUBJECT_COLORS = [
  "#FFFFFF", // Blanco
  "#3B82F6", // Azul clásico
  "#EF4444", // Rojo intenso
  "#10B981", // Verde esmeralda
  "#F59E0B", // Amarillo / Dorado
  "#8B5CF6", // Morado
  "#F97316", // Naranja
  "#06B6D4", // Celeste
  "#EC4899", // Rosado
] as const;
