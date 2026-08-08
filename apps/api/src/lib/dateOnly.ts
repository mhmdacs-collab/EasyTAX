export function dateOnly(value: unknown): string {
  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
    if (match) return match[1]!
  }

  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error("Invalid database date")

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
