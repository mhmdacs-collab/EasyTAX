import assert from "node:assert/strict"
import test from "node:test"
import { generateZatcaQrString } from "./qr"

void test("ZATCA QR contains the five mandatory TLV fields using final totals",()=>{
  const encoded=generateZatcaQrString({sellerName:"شركة اختبار",vatNumber:"310123456700003",invoiceDateTime:"2026-08-06T12:30:00Z",totalWithVat:1150,vatAmount:150})
  const bytes=Buffer.from(encoded,"base64"),values=new Map<number,string>()
  for(let offset=0;offset<bytes.length;){const tag=bytes[offset]??0,length=bytes[offset+1]??0;values.set(tag,bytes.subarray(offset+2,offset+2+length).toString("utf8"));offset+=2+length}
  assert.equal(values.size,5)
  assert.equal(values.get(1),"شركة اختبار")
  assert.equal(values.get(2),"310123456700003")
  assert.equal(values.get(3),"2026-08-06T12:30:00Z")
  assert.equal(values.get(4),"1150.00")
  assert.equal(values.get(5),"150.00")
})
