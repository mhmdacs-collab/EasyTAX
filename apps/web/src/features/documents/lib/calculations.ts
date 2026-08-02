export const VAT_RATE = 15 // هيئة الزكاة والضريبة والجمارك — القيمة الافتراضية

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** حساب مجموع بند واحد بعد الخصم */
export function calcItemSubtotal(
  unitPrice: number,
  quantity: number,
  discountPercent = 0
): number {
  const base = unitPrice * quantity
  return round2(base * (1 - discountPercent / 100))
}

export interface DocumentTotals {
  subtotal: number          // مجموع البنود قبل الضريبة
  discount_amount: number   // خصم المستند
  retention_amount: number  // استقطاع
  taxable_amount: number    // الوعاء الضريبي
  vat_amount: number        // ضريبة القيمة المضافة
  total: number             // الإجمالي الكلي
}

/**
 * حساب مجاميع المستند
 * @param items         - مصفوفة البنود مع مجاميعها
 * @param vatRate       - نسبة الضريبة (15 افتراضياً)
 * @param vatInclusive  - هل الأسعار شاملة الضريبة؟
 * @param discountAmt   - مبلغ الخصم على مستوى المستند
 * @param retentionAmt  - مبلغ الاستقطاع
 */
export function calcDocumentTotals(
  items: Array<{ subtotal: number }>,
  vatRate: number,
  vatInclusive: boolean,
  discountAmt = 0,
  retentionAmt = 0
): DocumentTotals {
  const subtotal = round2(items.reduce((s, i) => s + i.subtotal, 0))
  const taxable = round2(subtotal - discountAmt - retentionAmt)

  let vatAmount: number
  let total: number

  if (vatInclusive) {
    // الأسعار شاملة — نستخرج الضريبة بالخلف
    vatAmount = round2(taxable * vatRate / (100 + vatRate))
    total = taxable
  } else {
    vatAmount = round2(taxable * vatRate / 100)
    total = round2(taxable + vatAmount)
  }

  return {
    subtotal,
    discount_amount: round2(discountAmt),
    retention_amount: round2(retentionAmt),
    taxable_amount: taxable,
    vat_amount: vatAmount,
    total,
  }
}

export const DOCUMENT_TYPE_LABELS = {
  tax_invoice: "فاتورة ضريبية",
  simplified_invoice: "فاتورة مبسطة",
  quotation: "عرض سعر",
  proforma: "فاتورة أولية",
  receipt_voucher: "إيصال استلام",
} as const

export const DOCUMENT_TYPE_PREFIX = {
  tax_invoice: "INV",
  simplified_invoice: "SINV",
  quotation: "QT",
  proforma: "PF",
  receipt_voucher: "RC",
} as const

export const DOCUMENT_STATUS_LABELS = {
  draft: "مسودة",
  issued: "صادرة",
  archived: "مؤرشفة",
  cancelled: "ملغاة",
} as const

export const DOCUMENT_STATUS_COLORS = {
  draft: "secondary",
  issued: "success",
  archived: "outline",
  cancelled: "destructive",
} as const satisfies Record<string, "secondary" | "success" | "outline" | "destructive">
