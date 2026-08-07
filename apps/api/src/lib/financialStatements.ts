export const financialInputKeys = [
  "cash_and_cash_equivalents",
  "inventory",
  "other_current_assets",
  "related_party_receivable",
  "property_plant_equipment",
  "intangible_assets",
  "investment_property",
  "equity_method_investments",
  "other_non_current_assets",
  "current_loans",
  "non_current_loans",
  "employee_benefits",
  "zakat_payable",
  "taxes_payable",
  "related_party_payable",
  "other_current_liabilities",
  "other_non_current_liabilities",
  "capital",
  "statutory_reserve",
  "retained_earnings_opening",
  "other_equity",
  "owner_distributions",
  "other_income",
  "finance_cost",
  "zakat_expense",
  "income_tax_expense",
  "depreciation_expense",
  "other_comprehensive_income",
] as const

export type FinancialInputKey = (typeof financialInputKeys)[number]

export const financialInputDefinitions: Array<{
  key: FinancialInputKey
  label: string
  group: "assets" | "liabilities" | "equity" | "income"
  description: string
}> = [
  { key: "cash_and_cash_equivalents", label: "النقد وما في حكمه", group: "assets", description: "الرصيد الفعلي للصندوق والحسابات البنكية في نهاية السنة." },
  { key: "inventory", label: "المخزون", group: "assets", description: "قيمة المخزون في نهاية السنة إن وجد." },
  { key: "other_current_assets", label: "موجودات متداولة أخرى", group: "assets", description: "أي أصول قصيرة الأجل لا تدخل في البنود السابقة." },
  { key: "related_party_receivable", label: "مطلوب من أطراف ذات علاقة", group: "assets", description: "المبالغ المستحقة للمنشأة من الشركاء أو الأطراف ذات العلاقة." },
  { key: "property_plant_equipment", label: "ممتلكات وآلات ومعدات - بالصافي", group: "assets", description: "القيمة الدفترية بعد الإهلاك، أو اتركه فارغًا لاعتماد مشتريات الأصول المسجلة." },
  { key: "intangible_assets", label: "موجودات غير ملموسة", group: "assets", description: "مثل البرامج والتراخيص طويلة الأجل." },
  { key: "investment_property", label: "العقارات الاستثمارية", group: "assets", description: "العقارات المحتفظ بها للاستثمار إن وجدت." },
  { key: "equity_method_investments", label: "استثمارات بطريقة حقوق الملكية", group: "assets", description: "استثمارات الشركات الزميلة والمشروعات المشتركة إن وجدت." },
  { key: "other_non_current_assets", label: "موجودات غير متداولة أخرى", group: "assets", description: "أي أصول طويلة الأجل أخرى." },
  { key: "current_loans", label: "قروض والتزامات متداولة", group: "liabilities", description: "الأقساط والقروض المستحقة خلال اثني عشر شهرًا." },
  { key: "non_current_loans", label: "قروض والتزامات غير متداولة", group: "liabilities", description: "القروض المستحقة بعد أكثر من اثني عشر شهرًا." },
  { key: "employee_benefits", label: "التزام منافع الموظفين", group: "liabilities", description: "مكافآت نهاية الخدمة والالتزامات طويلة الأجل للموظفين." },
  { key: "zakat_payable", label: "الزكاة مستحقة الدفع", group: "liabilities", description: "رصيد الزكاة غير المسدد في نهاية السنة." },
  { key: "taxes_payable", label: "الضرائب مستحقة الدفع", group: "liabilities", description: "الضريبة المستحقة وغير المسددة في نهاية السنة." },
  { key: "related_party_payable", label: "مطلوب إلى أطراف ذات علاقة", group: "liabilities", description: "المبالغ المستحقة للشركاء أو الأطراف ذات العلاقة." },
  { key: "other_current_liabilities", label: "مطلوبات متداولة أخرى", group: "liabilities", description: "المصاريف المستحقة والالتزامات القصيرة الأخرى." },
  { key: "other_non_current_liabilities", label: "مطلوبات غير متداولة أخرى", group: "liabilities", description: "أي التزامات طويلة الأجل أخرى." },
  { key: "capital", label: "رأس المال", group: "equity", description: "رأس المال المسجل أو المدفوع في نهاية السنة." },
  { key: "statutory_reserve", label: "الاحتياطي النظامي", group: "equity", description: "رصيد الاحتياطي النظامي في نهاية السنة." },
  { key: "retained_earnings_opening", label: "الأرباح المبقاة أول السنة", group: "equity", description: "الرصيد المرحل قبل إضافة نتيجة السنة الحالية." },
  { key: "other_equity", label: "عناصر أخرى لحقوق الملكية", group: "equity", description: "أي بنود أخرى ضمن حقوق الملكية." },
  { key: "owner_distributions", label: "توزيعات أو مسحوبات الملاك", group: "equity", description: "المبالغ المسحوبة خلال السنة، وتدخل كقيمة موجبة ليطرحها النظام." },
  { key: "other_income", label: "دخل آخر", group: "income", description: "إيرادات لا تنتج من النشاط الرئيسي." },
  { key: "finance_cost", label: "تكلفة مصروف التمويل", group: "income", description: "فوائد وتكاليف التمويل خلال السنة." },
  { key: "zakat_expense", label: "مصروف الزكاة", group: "income", description: "مصروف الزكاة الخاص بالسنة المالية." },
  { key: "income_tax_expense", label: "مصروف ضريبة الدخل", group: "income", description: "يستخدم عند انطباق ضريبة الدخل على المنشأة." },
  { key: "depreciation_expense", label: "مصروف الإهلاك", group: "income", description: "إهلاك الممتلكات والآلات والمعدات خلال السنة." },
  { key: "other_comprehensive_income", label: "الدخل الشامل الآخر", group: "income", description: "مكاسب أو خسائر لا تظهر ضمن صافي الربح." },
]

export type FinancialInputValue = { current: number | null; prior: number | null; note?: string }

export type FinancialSourceTotals = {
  revenue: number
  invoiceTotal: number
  salesTax: number
  taxPurchases: number
  purchaseTax: number
  directCosts: number
  employeeExpenses: number
  operatingExpenses: number
  otherExpenses: number
  fixedAssetAdditions: number
  fixedAssetBalance: number
  prepaymentBalance: number
  receiptInflows: number
  standaloneAdvances: number
  expensePayments: number
  systemCashBalance: number
  tradeReceivables: number
  tradePayables: number
  invoiceCount: number
  purchaseCount: number
  expenseCount: number
}

export type StatementRow = {
  code: string
  label: string
  kind: "heading" | "line" | "subtotal" | "total"
  current: number
  prior: number
}

export type EquityMovementRow = {
  code: string
  label: string
  capital: number
  statutoryReserve: number
  retainedEarnings: number
  otherEquity: number
  total: number
}

export type FinancialValidationIssue = {
  code: string
  severity: "error" | "warning" | "info"
  message: string
  difference?: number
}

export type FinancialStatementReport = {
  organization: { id: string; businessName: string; legalForm: string; vatNumber: string; commercialRegistration: string }
  period: { fiscalYear: number; startsOn: string; endsOn: string; priorStartsOn: string; priorEndsOn: string; currency: "SAR" }
  sourceSummary: FinancialSourceTotals & { prior: FinancialSourceTotals }
  inputs: Partial<Record<FinancialInputKey, FinancialInputValue>>
  inputDefinitions: typeof financialInputDefinitions
  statements: {
    financialPosition: StatementRow[]
    comprehensiveIncome: StatementRow[]
    changesInEquity: EquityMovementRow[]
    cashFlows: StatementRow[]
  }
  totals: {
    assets: number
    liabilitiesAndEquity: number
    netProfit: number
    comprehensiveIncome: number
    closingCash: number
    calculatedClosingCash: number
  }
  validation: { isExportable: boolean; issues: FinancialValidationIssue[] }
}

export type BuildFinancialStatementsInput = {
  organization: FinancialStatementReport["organization"]
  period: FinancialStatementReport["period"]
  current: FinancialSourceTotals
  prior: FinancialSourceTotals
  inputs: Partial<Record<FinancialInputKey, FinancialInputValue>>
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

function provided(inputs: BuildFinancialStatementsInput["inputs"], key: FinancialInputKey, period: "current" | "prior") {
  const value = inputs[key]?.[period]
  return value === null || value === undefined ? undefined : round(Number(value))
}

function resolved(inputs: BuildFinancialStatementsInput["inputs"], key: FinancialInputKey, period: "current" | "prior", automatic = 0) {
  return provided(inputs, key, period) ?? round(automatic)
}

function total(values: number[]) {
  return round(values.reduce((sum, value) => sum + value, 0))
}

function statementRow(code: string, label: string, kind: StatementRow["kind"], current: number, prior: number): StatementRow {
  return { code, label, kind, current: round(current), prior: round(prior) }
}

export function buildFinancialStatements(input: BuildFinancialStatementsInput): FinancialStatementReport {
  const { current, prior, inputs } = input

  const depreciation = resolved(inputs, "depreciation_expense", "current")
  const priorDepreciation = resolved(inputs, "depreciation_expense", "prior")
  const otherIncome = resolved(inputs, "other_income", "current")
  const priorOtherIncome = resolved(inputs, "other_income", "prior")
  const financeCost = resolved(inputs, "finance_cost", "current")
  const priorFinanceCost = resolved(inputs, "finance_cost", "prior")
  const zakatExpense = resolved(inputs, "zakat_expense", "current")
  const priorZakatExpense = resolved(inputs, "zakat_expense", "prior")
  const incomeTaxExpense = resolved(inputs, "income_tax_expense", "current")
  const priorIncomeTaxExpense = resolved(inputs, "income_tax_expense", "prior")
  const otherComprehensiveIncome = resolved(inputs, "other_comprehensive_income", "current")
  const priorOtherComprehensiveIncome = resolved(inputs, "other_comprehensive_income", "prior")

  const costOfSales = total([current.taxPurchases, current.directCosts])
  const priorCostOfSales = total([prior.taxPurchases, prior.directCosts])
  const grossProfit = round(current.revenue - costOfSales)
  const priorGrossProfit = round(prior.revenue - priorCostOfSales)
  const administrativeExpenses = total([current.employeeExpenses, current.operatingExpenses, depreciation])
  const priorAdministrativeExpenses = total([prior.employeeExpenses, prior.operatingExpenses, priorDepreciation])
  const profitBeforeTax = round(grossProfit - administrativeExpenses - current.otherExpenses + otherIncome - financeCost)
  const priorProfitBeforeTax = round(priorGrossProfit - priorAdministrativeExpenses - prior.otherExpenses + priorOtherIncome - priorFinanceCost)
  const netProfit = round(profitBeforeTax - zakatExpense - incomeTaxExpense)
  const priorNetProfit = round(priorProfitBeforeTax - priorZakatExpense - priorIncomeTaxExpense)
  const totalComprehensiveIncome = round(netProfit + otherComprehensiveIncome)
  const priorTotalComprehensiveIncome = round(priorNetProfit + priorOtherComprehensiveIncome)

  const cash = resolved(inputs, "cash_and_cash_equivalents", "current", current.systemCashBalance)
  const priorCash = resolved(inputs, "cash_and_cash_equivalents", "prior", prior.systemCashBalance)
  const receivables = round(current.tradeReceivables)
  const priorReceivables = round(prior.tradeReceivables)
  const inventory = resolved(inputs, "inventory", "current")
  const priorInventory = resolved(inputs, "inventory", "prior")
  const prepayments = round(current.prepaymentBalance)
  const priorPrepayments = round(prior.prepaymentBalance)
  const otherCurrentAssets = resolved(inputs, "other_current_assets", "current")
  const priorOtherCurrentAssets = resolved(inputs, "other_current_assets", "prior")
  const relatedPartyReceivable = resolved(inputs, "related_party_receivable", "current")
  const priorRelatedPartyReceivable = resolved(inputs, "related_party_receivable", "prior")
  const propertyPlantEquipment = resolved(inputs, "property_plant_equipment", "current", Math.max(0, current.fixedAssetBalance - depreciation))
  const priorPropertyPlantEquipment = resolved(inputs, "property_plant_equipment", "prior", Math.max(0, prior.fixedAssetBalance - priorDepreciation))
  const intangibleAssets = resolved(inputs, "intangible_assets", "current")
  const priorIntangibleAssets = resolved(inputs, "intangible_assets", "prior")
  const investmentProperty = resolved(inputs, "investment_property", "current")
  const priorInvestmentProperty = resolved(inputs, "investment_property", "prior")
  const equityMethodInvestments = resolved(inputs, "equity_method_investments", "current")
  const priorEquityMethodInvestments = resolved(inputs, "equity_method_investments", "prior")
  const otherNonCurrentAssets = resolved(inputs, "other_non_current_assets", "current")
  const priorOtherNonCurrentAssets = resolved(inputs, "other_non_current_assets", "prior")

  const totalNonCurrentAssets = total([propertyPlantEquipment, intangibleAssets, investmentProperty, equityMethodInvestments, otherNonCurrentAssets])
  const priorTotalNonCurrentAssets = total([priorPropertyPlantEquipment, priorIntangibleAssets, priorInvestmentProperty, priorEquityMethodInvestments, priorOtherNonCurrentAssets])
  const totalCurrentAssets = total([prepayments, receivables, cash, inventory, otherCurrentAssets, relatedPartyReceivable])
  const priorTotalCurrentAssets = total([priorPrepayments, priorReceivables, priorCash, priorInventory, priorOtherCurrentAssets, priorRelatedPartyReceivable])
  const totalAssets = round(totalNonCurrentAssets + totalCurrentAssets)
  const priorTotalAssets = round(priorTotalNonCurrentAssets + priorTotalCurrentAssets)

  const tradePayables = round(current.tradePayables)
  const priorTradePayables = round(prior.tradePayables)
  const currentLoans = resolved(inputs, "current_loans", "current")
  const priorCurrentLoans = resolved(inputs, "current_loans", "prior")
  const nonCurrentLoans = resolved(inputs, "non_current_loans", "current")
  const priorNonCurrentLoans = resolved(inputs, "non_current_loans", "prior")
  const employeeBenefits = resolved(inputs, "employee_benefits", "current")
  const priorEmployeeBenefits = resolved(inputs, "employee_benefits", "prior")
  const zakatPayable = resolved(inputs, "zakat_payable", "current")
  const priorZakatPayable = resolved(inputs, "zakat_payable", "prior")
  const taxesPayable = resolved(inputs, "taxes_payable", "current")
  const priorTaxesPayable = resolved(inputs, "taxes_payable", "prior")
  const relatedPartyPayable = resolved(inputs, "related_party_payable", "current")
  const priorRelatedPartyPayable = resolved(inputs, "related_party_payable", "prior")
  const otherCurrentLiabilities = total([resolved(inputs, "other_current_liabilities", "current"), current.standaloneAdvances])
  const priorOtherCurrentLiabilities = total([resolved(inputs, "other_current_liabilities", "prior"), prior.standaloneAdvances])
  const otherNonCurrentLiabilities = resolved(inputs, "other_non_current_liabilities", "current")
  const priorOtherNonCurrentLiabilities = resolved(inputs, "other_non_current_liabilities", "prior")
  const totalCurrentLiabilities = total([currentLoans, zakatPayable, taxesPayable, relatedPartyPayable, tradePayables, otherCurrentLiabilities])
  const priorTotalCurrentLiabilities = total([priorCurrentLoans, priorZakatPayable, priorTaxesPayable, priorRelatedPartyPayable, priorTradePayables, priorOtherCurrentLiabilities])
  const totalNonCurrentLiabilities = total([employeeBenefits, nonCurrentLoans, otherNonCurrentLiabilities])
  const priorTotalNonCurrentLiabilities = total([priorEmployeeBenefits, priorNonCurrentLoans, priorOtherNonCurrentLiabilities])
  const totalLiabilities = round(totalCurrentLiabilities + totalNonCurrentLiabilities)
  const priorTotalLiabilities = round(priorTotalCurrentLiabilities + priorTotalNonCurrentLiabilities)

  const capital = resolved(inputs, "capital", "current")
  const priorCapital = resolved(inputs, "capital", "prior")
  const statutoryReserve = resolved(inputs, "statutory_reserve", "current")
  const priorStatutoryReserve = resolved(inputs, "statutory_reserve", "prior")
  const retainedOpening = resolved(inputs, "retained_earnings_opening", "current")
  const priorRetainedOpening = resolved(inputs, "retained_earnings_opening", "prior")
  const ownerDistributions = resolved(inputs, "owner_distributions", "current")
  const priorOwnerDistributions = resolved(inputs, "owner_distributions", "prior")
  const retainedEarnings = round(retainedOpening + netProfit - ownerDistributions)
  const priorRetainedEarnings = round(priorRetainedOpening + priorNetProfit - priorOwnerDistributions)
  const otherEquity = round(resolved(inputs, "other_equity", "current") + otherComprehensiveIncome)
  const priorOtherEquity = round(resolved(inputs, "other_equity", "prior") + priorOtherComprehensiveIncome)
  const totalEquity = total([capital, statutoryReserve, retainedEarnings, otherEquity])
  const priorTotalEquity = total([priorCapital, priorStatutoryReserve, priorRetainedEarnings, priorOtherEquity])
  const totalLiabilitiesAndEquity = round(totalLiabilities + totalEquity)
  const priorTotalLiabilitiesAndEquity = round(priorTotalLiabilities + priorTotalEquity)

  const financialPosition = [
    statementRow("assets", "الموجودات", "heading", 0, 0),
    statementRow("non_current_assets", "الموجودات غير المتداولة", "heading", 0, 0),
    statementRow("property_plant_equipment", "ممتلكات وآلات ومعدات", "line", propertyPlantEquipment, priorPropertyPlantEquipment),
    statementRow("intangible_assets", "موجودات غير ملموسة باستثناء الشهرة", "line", intangibleAssets, priorIntangibleAssets),
    statementRow("investment_property", "العقارات الاستثمارية", "line", investmentProperty, priorInvestmentProperty),
    statementRow("equity_method_investments", "الاستثمارات المحتسبة باستخدام طريقة حقوق الملكية", "line", equityMethodInvestments, priorEquityMethodInvestments),
    statementRow("other_non_current_assets", "موجودات غير متداولة أخرى", "line", otherNonCurrentAssets, priorOtherNonCurrentAssets),
    statementRow("total_non_current_assets", "إجمالي الموجودات غير المتداولة", "subtotal", totalNonCurrentAssets, priorTotalNonCurrentAssets),
    statementRow("current_assets", "الموجودات المتداولة", "heading", 0, 0),
    statementRow("prepayments", "مصاريف مدفوعة مقدمًا وأرصدة مدينة أخرى", "line", prepayments, priorPrepayments),
    statementRow("trade_receivables", "ذمم مدينة تجارية", "line", receivables, priorReceivables),
    statementRow("cash_and_cash_equivalents", "نقد وما في حكمه", "line", cash, priorCash),
    statementRow("inventory", "مخزون", "line", inventory, priorInventory),
    statementRow("other_current_assets", "موجودات متداولة أخرى", "line", otherCurrentAssets, priorOtherCurrentAssets),
    statementRow("related_party_receivable", "مطلوب من أطراف ذات علاقة", "line", relatedPartyReceivable, priorRelatedPartyReceivable),
    statementRow("total_current_assets", "إجمالي الموجودات المتداولة", "subtotal", totalCurrentAssets, priorTotalCurrentAssets),
    statementRow("total_assets", "إجمالي الموجودات", "total", totalAssets, priorTotalAssets),
    statementRow("equity_and_liabilities", "حقوق الملكية والمطلوبات", "heading", 0, 0),
    statementRow("equity", "حقوق الملكية", "heading", 0, 0),
    statementRow("capital", "رأس المال", "line", capital, priorCapital),
    statementRow("statutory_reserve", "احتياطي نظامي", "line", statutoryReserve, priorStatutoryReserve),
    statementRow("retained_earnings", "أرباح مبقاة (خسائر متراكمة)", "line", retainedEarnings, priorRetainedEarnings),
    statementRow("other_equity", "عناصر أخرى لحقوق الملكية", "line", otherEquity, priorOtherEquity),
    statementRow("total_equity", "إجمالي حقوق الملكية", "subtotal", totalEquity, priorTotalEquity),
    statementRow("non_current_liabilities", "المطلوبات غير المتداولة", "heading", 0, 0),
    statementRow("employee_benefits", "التزام منافع الموظفين", "line", employeeBenefits, priorEmployeeBenefits),
    statementRow("non_current_loans", "سندات دين وقروض لأجل وقروض وصكوك مصدرة - غير متداولة", "line", nonCurrentLoans, priorNonCurrentLoans),
    statementRow("other_non_current_liabilities", "مطلوبات غير متداولة أخرى", "line", otherNonCurrentLiabilities, priorOtherNonCurrentLiabilities),
    statementRow("total_non_current_liabilities", "إجمالي المطلوبات غير المتداولة", "subtotal", totalNonCurrentLiabilities, priorTotalNonCurrentLiabilities),
    statementRow("current_liabilities", "المطلوبات المتداولة", "heading", 0, 0),
    statementRow("current_loans", "سندات دين وقروض لأجل وقروض وصكوك مصدرة - متداولة", "line", currentLoans, priorCurrentLoans),
    statementRow("zakat_payable", "الزكاة مستحقة الدفع", "line", zakatPayable, priorZakatPayable),
    statementRow("taxes_payable", "الضرائب مستحقة الدفع", "line", taxesPayable, priorTaxesPayable),
    statementRow("related_party_payable", "مطلوب إلى أطراف ذات علاقة", "line", relatedPartyPayable, priorRelatedPartyPayable),
    statementRow("trade_payables", "المبالغ المستحقة للموردين والبائعين", "line", tradePayables, priorTradePayables),
    statementRow("other_current_liabilities", "مصاريف مستحقة وأرصدة دائنة ومطلوبات متداولة أخرى", "line", otherCurrentLiabilities, priorOtherCurrentLiabilities),
    statementRow("total_current_liabilities", "إجمالي المطلوبات المتداولة", "subtotal", totalCurrentLiabilities, priorTotalCurrentLiabilities),
    statementRow("total_liabilities", "إجمالي المطلوبات", "subtotal", totalLiabilities, priorTotalLiabilities),
    statementRow("total_equity_and_liabilities", "إجمالي حقوق الملكية والمطلوبات", "total", totalLiabilitiesAndEquity, priorTotalLiabilitiesAndEquity),
  ]

  const comprehensiveIncome = [
    statementRow("revenue", "مبيعات / الإيرادات", "line", current.revenue, prior.revenue),
    statementRow("cost_of_sales", "تكاليف المبيعات", "line", -costOfSales, -priorCostOfSales),
    statementRow("gross_profit", "مجمل الربح", "subtotal", grossProfit, priorGrossProfit),
    statementRow("administrative_expenses", "مصاريف إدارية وعمومية", "line", -administrativeExpenses, -priorAdministrativeExpenses),
    statementRow("other_expenses", "مصاريف أخرى", "line", -current.otherExpenses, -prior.otherExpenses),
    statementRow("other_income", "دخل آخر", "line", otherIncome, priorOtherIncome),
    statementRow("finance_cost", "تكلفة مصروف التمويل", "line", -financeCost, -priorFinanceCost),
    statementRow("profit_before_tax", "صافي ربح الفترة قبل الزكاة وضريبة الدخل", "subtotal", profitBeforeTax, priorProfitBeforeTax),
    statementRow("zakat_expense", "الزكاة", "line", -zakatExpense, -priorZakatExpense),
    statementRow("income_tax_expense", "ضريبة الدخل", "line", -incomeTaxExpense, -priorIncomeTaxExpense),
    statementRow("net_profit", "صافي ربح الفترة", "total", netProfit, priorNetProfit),
    statementRow("other_comprehensive_income", "الدخل الشامل الآخر", "line", otherComprehensiveIncome, priorOtherComprehensiveIncome),
    statementRow("total_comprehensive_income", "إجمالي الربح الشامل للفترة", "total", totalComprehensiveIncome, priorTotalComprehensiveIncome),
  ]

  const equityMovement = (code: string, label: string, values: [number, number, number, number]): EquityMovementRow => ({
    code,
    label,
    capital: round(values[0]),
    statutoryReserve: round(values[1]),
    retainedEarnings: round(values[2]),
    otherEquity: round(values[3]),
    total: total(values),
  })
  const changesInEquity = [
    equityMovement("opening_balance", "الرصيد في بداية الفترة", [priorCapital, priorStatutoryReserve, retainedOpening, resolved(inputs, "other_equity", "prior")]),
    equityMovement("capital_movement", "إضافات (تخفيضات) رأس المال", [capital - priorCapital, 0, 0, 0]),
    equityMovement("reserve_movement", "التغير في الاحتياطي النظامي", [0, statutoryReserve - priorStatutoryReserve, 0, 0]),
    equityMovement("net_profit", "صافي ربح الفترة", [0, 0, netProfit, 0]),
    equityMovement("owner_distributions", "توزيعات أو مسحوبات الملاك", [0, 0, -ownerDistributions, 0]),
    equityMovement("other_comprehensive_income", "الدخل الشامل الآخر", [0, 0, 0, otherComprehensiveIncome]),
    equityMovement("closing_balance", "الرصيد في نهاية الفترة", [capital, statutoryReserve, retainedEarnings, otherEquity]),
  ]

  const receivablesChange = round(receivables - priorReceivables)
  const inventoryChange = round(inventory - priorInventory)
  const prepaymentsChange = round(prepayments - priorPrepayments)
  const payablesChange = round(tradePayables - priorTradePayables)
  const employeeBenefitsChange = round(employeeBenefits - priorEmployeeBenefits)
  const taxesPayableChange = round(taxesPayable - priorTaxesPayable)
  const zakatPayableChange = round(zakatPayable - priorZakatPayable)
  const otherCurrentLiabilitiesChange = round(otherCurrentLiabilities - priorOtherCurrentLiabilities)
  const relatedPartyPayableChange = round(relatedPartyPayable - priorRelatedPartyPayable)
  const operatingCash = total([
    profitBeforeTax,
    depreciation,
    -receivablesChange,
    -inventoryChange,
    -prepaymentsChange,
    payablesChange,
    employeeBenefitsChange,
    taxesPayableChange,
    zakatPayableChange,
    otherCurrentLiabilitiesChange,
    relatedPartyPayableChange,
  ])
  const investingCash = round(-current.fixedAssetAdditions)
  const capitalMovement = round(capital - priorCapital)
  const loansMovement = round((currentLoans + nonCurrentLoans) - (priorCurrentLoans + priorNonCurrentLoans))
  const financingCash = round(capitalMovement + loansMovement - ownerDistributions)
  const netCashChange = round(operatingCash + investingCash + financingCash)
  const calculatedClosingCash = round(priorCash + netCashChange)

  const cashFlows = [
    statementRow("operating_activities", "الأنشطة التشغيلية", "heading", 0, 0),
    statementRow("profit_before_tax", "صافي ربح الفترة قبل الزكاة وضريبة الدخل", "line", profitBeforeTax, priorProfitBeforeTax),
    statementRow("depreciation", "استهلاك ممتلكات وآلات ومعدات", "line", depreciation, priorDepreciation),
    statementRow("receivables_change", "التغير في الذمم المدينة التجارية", "line", -receivablesChange, 0),
    statementRow("inventory_change", "التغير في المخزون", "line", -inventoryChange, 0),
    statementRow("prepayments_change", "التغير في المصاريف المدفوعة مقدمًا", "line", -prepaymentsChange, 0),
    statementRow("payables_change", "التغير في المبالغ المستحقة للموردين", "line", payablesChange, 0),
    statementRow("employee_benefits_change", "التغير في التزام منافع الموظفين", "line", employeeBenefitsChange, 0),
    statementRow("taxes_payable_change", "التغير في الضرائب مستحقة الدفع", "line", taxesPayableChange, 0),
    statementRow("zakat_payable_change", "التغير في الزكاة مستحقة الدفع", "line", zakatPayableChange, 0),
    statementRow("other_current_liabilities_change", "التغير في المطلوبات المتداولة الأخرى", "line", otherCurrentLiabilitiesChange, 0),
    statementRow("related_party_payable_change", "التغير في المطلوب إلى أطراف ذات علاقة", "line", relatedPartyPayableChange, 0),
    statementRow("net_operating_cash", "صافي النقد الناتج من الأنشطة التشغيلية", "subtotal", operatingCash, 0),
    statementRow("investing_activities", "الأنشطة الاستثمارية", "heading", 0, 0),
    statementRow("fixed_asset_additions", "إضافة ممتلكات وآلات ومعدات", "line", investingCash, -prior.fixedAssetAdditions),
    statementRow("net_investing_cash", "صافي النقد المستخدم في الأنشطة الاستثمارية", "subtotal", investingCash, -prior.fixedAssetAdditions),
    statementRow("financing_activities", "الأنشطة التمويلية", "heading", 0, 0),
    statementRow("capital_movement", "إضافة (تخفيض) رأس المال", "line", capitalMovement, 0),
    statementRow("loan_movement", "صافي التغير في القروض", "line", loansMovement, 0),
    statementRow("owner_distributions", "توزيعات أو مسحوبات الملاك", "line", -ownerDistributions, 0),
    statementRow("net_financing_cash", "صافي النقد الناتج من الأنشطة التمويلية", "subtotal", financingCash, 0),
    statementRow("net_cash_change", "صافي التغير في النقد وما في حكمه", "subtotal", netCashChange, 0),
    statementRow("opening_cash", "النقد وما في حكمه في بداية الفترة", "line", priorCash, 0),
    statementRow("closing_cash", "النقد وما في حكمه في نهاية الفترة", "total", calculatedClosingCash, priorCash),
  ]

  const balanceDifference = round(totalAssets - totalLiabilitiesAndEquity)
  const cashDifference = round(cash - calculatedClosingCash)
  const issues: FinancialValidationIssue[] = []
  if (Math.abs(balanceDifference) > 0.01) issues.push({ code: "BALANCE_SHEET_OUT_OF_BALANCE", severity: "error", message: "إجمالي الموجودات لا يساوي إجمالي المطلوبات وحقوق الملكية.", difference: balanceDifference })
  if (Math.abs(cashDifference) > 0.01) issues.push({ code: "CASH_FLOW_MISMATCH", severity: "error", message: "رصيد النقد الختامي لا يطابق الرصيد الناتج من قائمة التدفقات النقدية.", difference: cashDifference })
  if (provided(inputs, "cash_and_cash_equivalents", "current") === undefined) issues.push({ code: "CASH_NOT_CONFIRMED", severity: "warning", message: "لم يتم تأكيد رصيد الصندوق والبنوك؛ استخدم النظام الرصيد المستنتج من السندات والمصروفات المسجلة." })
  if (provided(inputs, "capital", "current") === undefined) issues.push({ code: "CAPITAL_NOT_CONFIRMED", severity: "warning", message: "أدخل رأس المال المسجل قبل اعتماد القوائم النهائية." })
  if (current.purchaseCount > 0) issues.push({ code: "PURCHASES_DEFAULT_CLASSIFICATION", severity: "info", message: "صُنفت فواتير المشتريات الضريبية ضمن تكاليف المبيعات مبدئيًا؛ راجع مشتريات الأصول قبل الإقفال." })
  if (prior.invoiceCount + prior.purchaseCount + prior.expenseCount === 0 && Object.values(inputs).every((value) => value?.prior === null || value?.prior === undefined)) issues.push({ code: "NO_COMPARATIVE_DATA", severity: "info", message: "لا توجد بيانات مقارنة للسنة السابقة؛ سيظهر عمود السنة السابقة بصفر." })

  return {
    organization: input.organization,
    period: input.period,
    sourceSummary: { ...current, prior },
    inputs,
    inputDefinitions: financialInputDefinitions,
    statements: { financialPosition, comprehensiveIncome, changesInEquity, cashFlows },
    totals: { assets: totalAssets, liabilitiesAndEquity: totalLiabilitiesAndEquity, netProfit, comprehensiveIncome: totalComprehensiveIncome, closingCash: cash, calculatedClosingCash },
    validation: { isExportable: !issues.some((issue) => issue.severity === "error"), issues },
  }
}
