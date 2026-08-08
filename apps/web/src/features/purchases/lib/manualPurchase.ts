const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateIncludedVat(total: number, rate = 15) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(rate) || rate < 0) {
    return { subtotal: 0, tax: 0 };
  }
  const tax = roundMoney((total * rate) / (100 + rate));
  return { subtotal: roundMoney(total - tax), tax };
}

export function manualInvoiceTimestamp(invoiceDate: string) {
  return `${invoiceDate}T12:00:00+03:00`;
}
