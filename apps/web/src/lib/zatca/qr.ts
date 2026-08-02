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
    binary += String.fromCharCode(bytes[i]!)
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
  const tlv = concatBuffers([
    tlvEntry(1, input.sellerName),
    tlvEntry(2, input.vatNumber),
    tlvEntry(3, input.invoiceDateTime),
    tlvEntry(4, input.totalWithVat.toFixed(2)),
    tlvEntry(5, input.vatAmount.toFixed(2)),
  ])
  return uint8ToBase64(tlv)
}
