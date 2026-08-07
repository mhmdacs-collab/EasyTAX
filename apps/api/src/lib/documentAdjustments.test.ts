import assert from "node:assert/strict"
import test from "node:test"
import { availableCreditAmount, calculateTaxAdjustment } from "./documentAdjustments"

test("credit and debit notes calculate VAT from the taxable correction", () => {
  assert.deepEqual(calculateTaxAdjustment(1_000), { taxable: 1_000, tax: 150, total: 1_150 })
  assert.deepEqual(calculateTaxAdjustment(99.99), { taxable: 99.99, tax: 15, total: 114.99 })
})

test("credit notes cannot exceed invoice value plus prior debit notes", () => {
  assert.equal(availableCreditAmount(1_150, 230, 115), 1_035)
  assert.equal(availableCreditAmount(1_150, 1_300, 0), 0)
})

