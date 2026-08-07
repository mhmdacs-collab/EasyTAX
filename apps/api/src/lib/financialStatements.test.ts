import assert from "node:assert/strict"
import test from "node:test"
import { buildFinancialStatements, type BuildFinancialStatementsInput, type FinancialSourceTotals } from "./financialStatements"

const emptySource = (): FinancialSourceTotals => ({
  revenue: 0,
  invoiceTotal: 0,
  salesTax: 0,
  taxPurchases: 0,
  purchaseTax: 0,
  directCosts: 0,
  employeeExpenses: 0,
  operatingExpenses: 0,
  otherExpenses: 0,
  fixedAssetAdditions: 0,
  fixedAssetBalance: 0,
  prepaymentBalance: 0,
  receiptInflows: 0,
  standaloneAdvances: 0,
  expensePayments: 0,
  systemCashBalance: 0,
  tradeReceivables: 0,
  tradePayables: 0,
  invoiceCount: 0,
  purchaseCount: 0,
  expenseCount: 0,
})

function baseInput(): BuildFinancialStatementsInput {
  return {
    organization: { id: "org-1", businessName: "منشأة الاختبار", legalForm: "limited_liability", vatNumber: "310000000000003", commercialRegistration: "1010000000" },
    period: { fiscalYear: 2026, startsOn: "2026-01-01", endsOn: "2026-12-31", priorStartsOn: "2025-01-01", priorEndsOn: "2025-12-31", currency: "SAR" },
    current: emptySource(),
    prior: emptySource(),
    inputs: {},
  }
}

test("builds balanced statements and reconciles VAT cash movement", () => {
  const input = baseInput()
  input.current = {
    ...emptySource(),
    revenue: 1_000,
    invoiceTotal: 1_150,
    salesTax: 150,
    receiptInflows: 1_150,
    systemCashBalance: 1_150,
    invoiceCount: 1,
  }
  input.inputs = {
    cash_and_cash_equivalents: { current: 1_150, prior: 0 },
    taxes_payable: { current: 150, prior: 0 },
    capital: { current: 0, prior: 0 },
  }

  const report = buildFinancialStatements(input)

  assert.equal(report.totals.assets, 1_150)
  assert.equal(report.totals.liabilitiesAndEquity, 1_150)
  assert.equal(report.totals.netProfit, 1_000)
  assert.equal(report.totals.calculatedClosingCash, 1_150)
  assert.equal(report.validation.isExportable, true)
})

test("keeps purchases, operating expenses and fixed assets in separate classifications", () => {
  const input = baseInput()
  input.current = {
    ...emptySource(),
    revenue: 10_000,
    invoiceTotal: 11_500,
    salesTax: 1_500,
    taxPurchases: 2_000,
    purchaseTax: 300,
    directCosts: 1_000,
    employeeExpenses: 2_000,
    operatingExpenses: 500,
    fixedAssetAdditions: 1_200,
    fixedAssetBalance: 1_200,
    purchaseCount: 1,
    expenseCount: 4,
  }
  input.inputs = {
    cash_and_cash_equivalents: { current: 0, prior: 0 },
    capital: { current: 0, prior: 0 },
  }

  const report = buildFinancialStatements(input)
  const income = Object.fromEntries(report.statements.comprehensiveIncome.map((row) => [row.code, row.current]))

  assert.equal(income.cost_of_sales, -3_000)
  assert.equal(income.administrative_expenses, -2_500)
  assert.equal(report.statements.financialPosition.find((row) => row.code === "property_plant_equipment")?.current, 1_200)
  assert.ok(report.validation.issues.some((issue) => issue.code === "PURCHASES_DEFAULT_CLASSIFICATION"))
})

test("blocks export when the balance sheet or cash flow does not reconcile", () => {
  const input = baseInput()
  input.current = { ...emptySource(), revenue: 1_000, invoiceTotal: 1_150, salesTax: 150, systemCashBalance: 1_150 }
  input.inputs = {
    cash_and_cash_equivalents: { current: 900, prior: 0 },
    capital: { current: 100, prior: 0 },
  }

  const report = buildFinancialStatements(input)

  assert.equal(report.validation.isExportable, false)
  assert.ok(report.validation.issues.some((issue) => issue.code === "BALANCE_SHEET_OUT_OF_BALANCE"))
  assert.ok(report.validation.issues.some((issue) => issue.code === "CASH_FLOW_MISMATCH"))
})
