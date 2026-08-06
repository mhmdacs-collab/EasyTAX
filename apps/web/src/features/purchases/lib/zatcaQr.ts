export type PurchaseQrData = {
  sellerName: string
  sellerVatNumber: string
  timestamp: string
  total: number
  taxTotal: number
  fields: Record<string, string>
  raw: string
}

const labels: Record<number, string> = {
  1: "seller_name", 2: "seller_vat_number", 3: "timestamp", 4: "invoice_total", 5: "vat_total",
  6: "invoice_hash", 7: "signature", 8: "public_key", 9: "zatca_signature",
}

export function decodePurchaseQr(raw: string): PurchaseQrData {
  let bytes: Uint8Array
  try {
    const normalized = raw.trim().replace(/-/g, "+").replace(/_/g, "/")
    const binary = atob(normalized)
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    throw new Error("رمز QR ليس بالصيغة المعتمدة للفواتير الإلكترونية")
  }
  const fields: Record<string, string> = {}
  let offset = 0
  while (offset + 2 <= bytes.length) {
    const tag = bytes[offset]
    const length = bytes[offset + 1]
    if (tag === undefined || length === undefined) break
    offset += 2
    if (offset + length > bytes.length) throw new Error("بيانات QR غير مكتملة")
    const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(offset, offset + length))
    offset += length
    fields[labels[tag] ?? `tag_${tag}`] = value
  }
  const sellerName = fields.seller_name?.trim() ?? ""
  const sellerVatNumber = fields.seller_vat_number?.trim() ?? ""
  const timestamp = fields.timestamp?.trim() ?? ""
  const total = Number(fields.invoice_total)
  const taxTotal = Number(fields.vat_total)
  if (!sellerName || !/^3\d{13}3$/.test(sellerVatNumber) || !timestamp || !Number.isFinite(total) || total <= 0 || !Number.isFinite(taxTotal) || taxTotal < 0 || taxTotal > total) {
    throw new Error("لم يحتوي QR على بيانات الفاتورة الضريبية الأساسية كاملة")
  }
  const parsedDate = new Date(timestamp)
  if (Number.isNaN(parsedDate.getTime())) throw new Error("تاريخ الفاتورة داخل QR غير صحيح")
  return { sellerName, sellerVatNumber, timestamp: parsedDate.toISOString(), total, taxTotal, fields, raw: raw.trim() }
}
