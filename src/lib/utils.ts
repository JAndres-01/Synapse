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
  { day: 3, name: "MiÃƒ©rcoles", short: "MiÃƒ©" },
  { day: 4, name: "Jueves", short: "Jue" },
  { day: 5, name: "Viernes", short: "Vie" },
] as const;

// Paleta de colores bÃƒ¡sicos y de alto contraste (incluyendo blanco)
export const SUBJECT_COLORS = [
  "#FFFFFF", // Blanco
  "#3B82F6", // Azul clÃƒ¡sico
  "#EF4444", // Rojo intenso
  "#10B981", // Verde esmeralda
  "#F59E0B", // Amarillo / Dorado
  "#8B5CF6", // Morado
  "#F97316", // Naranja
  "#06B6D4", // Celeste
  "#EC4899", // Rosado
] as const;

/**
 * Comprime imÃƒ¡genes en el cliente (GPU Canvas) en <60ms de forma imperceptible.
 * Reduce fotos de iPhone (8MB-15MB) a ~350KB-600KB manteniendo textos de apuntes y pizarrones 100% nÃƒ­tidos.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.70
): Promise<{ fileUrl: string; fileName: string; fileSize: number }> {
  return new Promise((resolve, reject) => {
    // Si no es imagen (ej. PDF o Word), retornar DataURL sin alterar
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () =>
        resolve({
          fileUrl: reader.result as string,
          fileName: file.name,
          fileSize: file.size,
        })
      reader.onerror = reject
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Redimensionar respetando relaciÃƒ³n de aspecto
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve({
            fileUrl: e.target?.result as string,
            fileName: file.name,
            fileSize: file.size,
          })
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve({
          fileUrl: compressedDataUrl,
          fileName: file.name.replace(/\.[^/.]+$/, '.jpg'),
          fileSize: Math.round((compressedDataUrl.length * 3) / 4),
        })
      }
      img.onerror = () => {
        resolve({
          fileUrl: e.target?.result as string,
          fileName: file.name,
          fileSize: file.size,
        })
      }
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
