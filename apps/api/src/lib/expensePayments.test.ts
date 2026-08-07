import assert from "node:assert/strict"
import test from "node:test"
import { applyExpensePayment, reverseRecordedPayment } from "./expensePayments"

void test("partial expense payment updates the remaining balance", () => {
  assert.deepEqual(applyExpensePayment(1_000, 200, 300), { ok:true, paid:500, remaining:500, status:"partially_paid" })
})

void test("final expense payment closes the balance", () => {
  assert.deepEqual(applyExpensePayment(1_000, 400, 600), { ok:true, paid:1_000, remaining:0, status:"paid" })
})

void test("expense payment cannot exceed the remaining balance", () => {
  assert.deepEqual(applyExpensePayment(1_000, 800, 300), { ok:false, reason:"INVALID_AMOUNT", remaining:200 })
})

void test("reversing a purchase payment reopens the correct supplier balance", () => {
  assert.deepEqual(reverseRecordedPayment(1_000, 1_000, 300), { ok:true, paid:700, remaining:300, status:"partially_paid" })
  assert.deepEqual(reverseRecordedPayment(1_000, 300, 300), { ok:true, paid:0, remaining:1_000, status:"unpaid" })
})
