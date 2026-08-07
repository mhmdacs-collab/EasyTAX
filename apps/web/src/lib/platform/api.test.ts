import assert from "node:assert/strict"
import test from "node:test"
import { validationMessage } from "./errorMessage"

void test("extracts a readable message from serialized Zod issues", () => {
  const serialized = JSON.stringify([{ origin:"string", code:"invalid_format", path:["beneficiary_iban"], message:"رقم الآيبان غير صحيح" }])
  assert.equal(validationMessage(serialized), "رقم الآيبان غير صحيح")
})
