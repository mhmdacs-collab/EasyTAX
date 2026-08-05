/**
 * ZATCA Phase 1 QR Code — TLV (Tag-Length-Value) encoding
 *
 * Tags:
 *   1 - Seller name
 *   2 - VAT registration number
 *   3 - Invoice date/time (ISO 8601)
 *   4 - Invoice total (with VAT)
 *   5 - VAT amount
 */

function tlvEntry(tag: number, value: string): Uint8Array {
  const enc = new TextEncoder()
  const valueBytes = enc.encode(value)
  if (valueBytes.length > 255) {
    throw new Error(`قيمة الحقل ${tag} في QR تتجاوز الحد المسموح`)
  }
  const result = new Uint8Array(2 + valueBytes.length)
  result[0] = tag
  result[1] = valueBytes.length
  result.set(valueBytes, 2)
  return result
}

function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((n, b) => n + b.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const b of buffers) {
    out.set(b, offset)
    offset += b.length
  }
  return out
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
}

export interface ZatcaQrInput {
  sellerName: string
  vatNumber: string
  invoiceDateTime: string  // ISO 8601, e.g. "2024-01-15T10:30:00Z"
  totalWithVat: number
  vatAmount: number
}

/** Returns a base64-encoded TLV string ready to embed in a QR code */
export function generateZatcaQrString(input: ZatcaQrInput): string {
  const sellerName = input.sellerName.trim()
  const vatNumber = input.vatNumber.replace(/\D/g, "")
  const issuedAt = new Date(input.invoiceDateTime)

  if (!sellerName) throw new Error("اسم البائع مطلوب لإنشاء QR")
  if (!/^3\d{13}3$/.test(vatNumber)) throw new Error("الرقم الضريبي للبائع يجب أن يكون 15 رقمًا ويبدأ وينتهي بالرقم 3")
  if (Number.isNaN(issuedAt.getTime())) throw new Error("تاريخ إصدار الفاتورة غير صالح")
  if (!Number.isFinite(input.totalWithVat) || input.totalWithVat < 0) throw new Error("إجمالي الفاتورة غير صالح")
  if (!Number.isFinite(input.vatAmount) || input.vatAmount < 0) throw new Error("إجمالي الضريبة غير صالح")

  const tlv = concatBuffers([
    tlvEntry(1, sellerName),
    tlvEntry(2, vatNumber),
    tlvEntry(3, issuedAt.toISOString().replace(/\.\d{3}Z$/, "Z")),
    tlvEntry(4, input.totalWithVat.toFixed(2)),
    tlvEntry(5, input.vatAmount.toFixed(2)),
  ])
  const encoded = uint8ToBase64(tlv)
  if (encoded.length > 700) throw new Error("بيانات QR تتجاوز الحد المسموح من الهيئة")
  return encoded
}
