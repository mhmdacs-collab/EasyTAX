import test from "node:test"
import assert from "node:assert/strict"
import { decodePurchaseQr } from "./zatcaQr"

function tlv(values: string[]) {
  const chunks = values.map((value, index) => {
    const bytes = Buffer.from(value, "utf8")
    return Buffer.concat([Buffer.from([index + 1, bytes.length]), bytes])
  })
  return Buffer.concat(chunks).toString("base64")
}

void test("decodes the five mandatory purchase QR values", () => {
  const decoded = decodePurchaseQr(tlv(["مورد تجريبي", "310123456700003", "2026-08-06T12:00:00Z", "115.00", "15.00"]))
  assert.equal(decoded.sellerName, "مورد تجريبي")
  assert.equal(decoded.total, 115)
  assert.equal(decoded.taxTotal, 15)
})

void test("rejects a QR without mandatory tax invoice data", () => {
  assert.throws(() => decodePurchaseQr(tlv(["مورد", "123", "bad", "0", "4"])))
})
