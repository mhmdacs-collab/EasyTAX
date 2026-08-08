import assert from "node:assert/strict"
import test from "node:test"
import { dateOnly } from "./dateOnly"

test("keeps PostgreSQL date strings unchanged", () => {
  assert.equal(dateOnly("2026-08-08"), "2026-08-08")
})

test("formats PostgreSQL Date objects as ISO calendar dates", () => {
  assert.equal(dateOnly(new Date(2026, 7, 8)), "2026-08-08")
})

test("rejects invalid database dates", () => {
  assert.throws(() => dateOnly("not-a-date"), /Invalid database date/)
})
