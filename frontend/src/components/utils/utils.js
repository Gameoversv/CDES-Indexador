import clsx from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind de forma segura, evitando conflictos.
 * @param  {...any} inputs - Clases condicionales o estáticas
 * @returns {string} - Clases fusionadas correctamente
 */
export function cn(...inputs) {
  return twMerge(clsx(...inputs));
}
