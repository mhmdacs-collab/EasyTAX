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
  purchasePayments: 0,
  openingCash: 0,
  capitalBalance: 0,
  ownerWithdrawals: 0,
  currentLoanBalance: 0,
  nonCurrentLoanBalance: 0,
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
    prepaymentBalance: 350,
    tradeReceivables: 2_400,
    tradePayables: 900,
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
  assert.equal(report.statements.financialPosition.find((row) => row.code === "prepayments")?.current, 350)
  assert.equal(report.statements.financialPosition.find((row) => row.code === "trade_receivables")?.current, 2_400)
  assert.equal(report.statements.financialPosition.find((row) => row.code === "trade_payables")?.current, 900)
  assert.ok(report.validation.issues.some((issue) => issue.code === "PURCHASES_DEFAULT_CLASSIFICATION"))
})

test("reclassifies only the exceptional purchase totals without classifying every invoice", () => {
  const input = baseInput()
  input.current = {
    ...emptySource(),
    revenue: 50_000,
    taxPurchases: 20_000,
    purchaseCount: 4,
  }
  input.inputs = {
    purchase_fixed_asset_reclassification: { current: 5_000, prior: 0 },
    purchase_prepayment_reclassification: { current: 5_000, prior: 0 },
    depreciation_expense: { current: 0, prior: 0 },
  }

  const report = buildFinancialStatements(input)
  const income = Object.fromEntries(report.statements.comprehensiveIncome.map((row) => [row.code, row.current]))
  const position = Object.fromEntries(report.statements.financialPosition.map((row) => [row.code, row.current]))

  assert.equal(income.cost_of_sales, -10_000)
  assert.equal(income.gross_profit, 40_000)
  assert.equal(position.property_plant_equipment, 5_000)
  assert.equal(position.prepayments, 5_000)
  assert.equal(report.statements.cashFlows.find((row) => row.code === "fixed_asset_additions")?.current, -5_000)
  assert.equal(report.validation.issues.some((issue) => issue.code === "PURCHASES_DEFAULT_CLASSIFICATION"), false)
})

test("blocks purchase reclassification above the recorded purchase total", () => {
  const input = baseInput()
  input.current = { ...emptySource(), taxPurchases: 5_000, purchaseCount: 1 }
  input.inputs = {
    purchase_fixed_asset_reclassification: { current: 4_000, prior: 0 },
    purchase_prepayment_reclassification: { current: 2_000, prior: 0 },
  }

  const report = buildFinancialStatements(input)

  assert.equal(report.validation.isExportable, false)
  assert.ok(report.validation.issues.some((issue) => issue.code === "PURCHASE_RECLASSIFICATION_EXCEEDS_TOTAL"))
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

test("uses recorded capital, owner withdrawals and loans without duplicate manual inputs", () => {
  const input = baseInput()
  input.current = {
    ...emptySource(),
    capitalBalance: 1_000,
    ownerWithdrawals: 100,
    currentLoanBalance: 500,
    systemCashBalance: 1_400,
  }

  const report = buildFinancialStatements(input)

  assert.equal(report.statements.financialPosition.find((row) => row.code === "cash_and_cash_equivalents")?.current, 1_400)
  assert.equal(report.statements.financialPosition.find((row) => row.code === "current_loans")?.current, 500)
  assert.equal(report.statements.financialPosition.find((row) => row.code === "capital")?.current, 1_000)
  assert.equal(report.statements.changesInEquity.find((row) => row.code === "owner_distributions")?.total, -100)
  assert.equal(report.totals.calculatedClosingCash, 1_400)
  assert.equal(report.validation.isExportable, true)
})
