import assert from "node:assert/strict"
import test from "node:test"
import { expenseCategories, financialClassForCategory } from "./categories"

void test("keeps the daily expense choices limited to seven categories", () => {
  assert.equal(expenseCategories.length, 7)
})

void test("maps payroll and equipment to their financial classes", () => {
  assert.equal(financialClassForCategory("payroll"), "employee_expense")
  assert.equal(financialClassForCategory("asset_equipment"), "fixed_asset")
  assert.equal(financialClassForCategory("work_costs"), "direct_cost")
})
