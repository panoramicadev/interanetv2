import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getNumericOrderId = (uuid: string) => {
  if (!uuid) return '';
  const hexPart = uuid.replace(/-/g, '').substring(0, 6);
  return parseInt(hexPart, 16).toString();
};
