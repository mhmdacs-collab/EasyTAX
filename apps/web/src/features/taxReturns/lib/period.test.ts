import test from "node:test"
import assert from "node:assert/strict"
import { dateWithinPeriod } from "./period"

void test("tax return exports include only dates inside the selected period",()=>{
  assert.equal(dateWithinPeriod("2026-07-01","2026-07-01","2026-09-30"),true)
  assert.equal(dateWithinPeriod("2026-09-30T23:30:00Z","2026-07-01","2026-09-30"),true)
  assert.equal(dateWithinPeriod("2026-06-30","2026-07-01","2026-09-30"),false)
  assert.equal(dateWithinPeriod("2026-10-01","2026-07-01","2026-09-30"),false)
})
