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
  const safeDiscountPercent = Math.min(100, Math.max(0, discountPercent))
  return round2(Math.max(0, base * (1 - safeDiscountPercent / 100)))
}

export interface DocumentTotals {
  subtotal: number          // مجموع البنود بعد خصومات البنود
  discount_amount: number   // خصم المستند
  retention_amount: number  // حجز ضمان الأعمال
  taxable_amount: number    // الوعاء الضريبي
  vat_amount: number        // ضريبة القيمة المضافة
  total: number             // إجمالي الفاتورة شامل الضريبة وقبل حجز الضمان
  payable_amount: number    // صافي المطلوب بعد حجز الضمان
}

/**
 * حساب مجاميع المستند
 * @param items         - مصفوفة البنود مع مجاميعها
 * @param vatRate       - نسبة الضريبة (15 افتراضياً)
 * @param vatInclusive  - هل الأسعار شاملة الضريبة؟
 * @param discountAmt   - مبلغ الخصم على مستوى المستند
 * @param retentionAmt  - مبلغ حجز الضمان قبل الخصم الإضافي
 */
export function calcDocumentTotals(
  items: Array<{ subtotal: number }>,
  vatRate: number,
  vatInclusive: boolean,
  discountAmt = 0,
  retentionAmt = 0
): DocumentTotals {
  const subtotal = round2(Math.max(0, items.reduce((s, i) => s + i.subtotal, 0)))
  const safeDiscount = round2(Math.min(subtotal, Math.max(0, discountAmt)))
  const discountRatio = subtotal > 0 ? (subtotal - safeDiscount) / subtotal : 1
  const safeRetention = round2(Math.min(subtotal - safeDiscount, Math.max(0, retentionAmt) * discountRatio))
  const amountAfterDiscount = round2(Math.max(0, subtotal - safeDiscount))

  let vatAmount: number
  let taxable: number
  let total: number

  if (vatInclusive) {
    // الأسعار شاملة — نستخرج الضريبة بالخلف
    vatAmount = round2(amountAfterDiscount * vatRate / (100 + vatRate))
    taxable = round2(amountAfterDiscount - vatAmount)
    total = amountAfterDiscount
  } else {
    taxable = amountAfterDiscount
    vatAmount = round2(taxable * vatRate / 100)
    total = round2(taxable + vatAmount)
  }

  return {
    subtotal,
    discount_amount: safeDiscount,
    retention_amount: safeRetention,
    taxable_amount: taxable,
    vat_amount: vatAmount,
    total,
    payable_amount: round2(Math.max(0, total - safeRetention)),
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
  paid: "مدفوعة",
  partially_paid: "مدفوعة جزئيًا",
  archived: "مؤرشفة",
  cancelled: "ملغاة",
} as const

export const DOCUMENT_STATUS_COLORS = {
  draft: "secondary",
  issued: "success",
  paid: "success",
  partially_paid: "secondary",
  archived: "outline",
  cancelled: "destructive",
} as const satisfies Record<string, "secondary" | "success" | "outline" | "destructive">
