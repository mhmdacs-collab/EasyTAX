import assert from "node:assert/strict";
import test from "node:test";
import { calculateIncludedVat, manualInvoiceTimestamp } from "./manualPurchase";

void test("calculates VAT included in a standard-rate total", () => {
  assert.deepEqual(calculateIncludedVat(3960), { subtotal: 3443.48, tax: 516.52 });
});

void test("does not invent tax for an empty amount", () => {
  assert.deepEqual(calculateIncludedVat(0), { subtotal: 0, tax: 0 });
});

void test("creates a stable Riyadh timestamp from the invoice date", () => {
  assert.equal(manualInvoiceTimestamp("2026-08-08"), "2026-08-08T12:00:00+03:00");
});
