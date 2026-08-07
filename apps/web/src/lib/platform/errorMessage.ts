export function validationMessage(value: unknown): string | undefined {
  if (Array.isArray(value)) return validationMessage(value[0])
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return validationMessage(record.issues) ?? validationMessage(record.error) ?? validationMessage(record.message)
  }
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try { return validationMessage(JSON.parse(trimmed) as unknown) } catch { return trimmed }
  }
  return trimmed
}

export function platformErrorMessage(body: { error?: unknown; message?: unknown }) {
  return validationMessage(body.error) ?? validationMessage(body.message) ?? "تعذر إتمام الطلب"
}
