import assert from "node:assert/strict"
import test from "node:test"
import { amountInWords } from "./amountInWords"

void test("receipt amount words preserve riyals and halalas",()=>{
  assert.equal(amountInWords(1150.75),"فقط ألف ومائة وخمسون ريال سعودي وخمسة وسبعون هللة لا غير")
  assert.equal(amountInWords(1_000_000),"فقط مليون ريال سعودي لا غير")
})
