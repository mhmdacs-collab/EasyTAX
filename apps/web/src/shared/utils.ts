/** توليد معرف فريد */
export function generateId(): string {
  return crypto.randomUUID()
}

/** تنسيق المبالغ بالريال السعودي */
export function formatCurrency(amount: number, options?: Intl.NumberFormatOptions): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount)
  return `${formatted} ر.س`
}

/** تنسيق التاريخ */
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.slice(0, 10).split("-")
  return year && month && day ? `${year}/${month}/${day}` : dateStr
}

/** دمج أسماء الكلاسات */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ")
}
