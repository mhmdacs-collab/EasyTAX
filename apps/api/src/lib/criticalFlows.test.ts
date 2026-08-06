import assert from "node:assert/strict"
import test from "node:test"
import { calculateDocument } from "./documentCalculations"

const item={description:"خدمة",quantity:1,unit_price:1000,discount_percent:10,retention_percent:5}

test("exclusive VAT keeps item discount, invoice discount, tax and retention separate",()=>{
  const result=calculateDocument({prices_include_tax:false,retention_basis:"before_tax",discount_amount:100,items:[item]})
  assert.equal(result.subtotal,900)
  assert.equal(result.discountTotal,100)
  assert.equal(result.taxTotal,120)
  assert.equal(result.retentionTotal,40)
  assert.equal(result.total,920)
  assert.equal(result.payableTotal,880)
})

test("inclusive VAT extracts VAT and calculates retention on the selected basis",()=>{
  const result=calculateDocument({prices_include_tax:true,retention_basis:"including_tax",discount_amount:0,items:[{...item,unit_price:1150,discount_percent:0,retention_percent:10}]})
  assert.equal(result.subtotal,1000)
  assert.equal(result.taxTotal,150)
  assert.equal(result.retentionTotal,115)
  assert.equal(result.total,1150)
  assert.equal(result.payableTotal,1035)
})
