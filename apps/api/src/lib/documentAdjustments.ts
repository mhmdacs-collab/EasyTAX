const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function calculateTaxAdjustment(taxableAmount: number, taxRate = 15) {
  const taxable = roundMoney(taxableAmount)
  const tax = roundMoney(taxable * taxRate / 100)
  return { taxable, tax, total: roundMoney(taxable + tax) }
}

export function availableCreditAmount(originalTotal: number, priorCredits: number, priorDebits: number) {
  return Math.max(0, roundMoney(originalTotal + priorDebits - priorCredits))
}

