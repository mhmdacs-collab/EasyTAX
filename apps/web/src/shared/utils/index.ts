import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, _currency = "SAR"): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ر.س`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? date.slice(0, 10) : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const [year, month, day] = d.split("-");
  return year && month && day ? `${year}/${month}/${day}` : d;
}

export function generateId(): string {
  return crypto.randomUUID();
}
