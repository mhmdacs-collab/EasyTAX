import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Calculator, FilePenLine, ShieldCheck } from "lucide-react";
import { createTaxPurchase, type TaxPurchaseInput } from "@/lib/platform/api";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { formatCurrency } from "@/shared/utils";
import { calculateIncludedVat, manualInvoiceTimestamp } from "../lib/manualPurchase";

type PaymentStatus = TaxPurchaseInput["payment_status"];
type PaymentMethod = NonNullable<TaxPurchaseInput["initial_payment"]>["payment_method"];

const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "card", label: "شبكة / بطاقة" },
  { value: "sadad", label: "سداد" },
];

const paymentStatuses: Array<{ value: PaymentStatus; label: string }> = [
  { value: "paid", label: "مدفوعة بالكامل" },
  { value: "partially_paid", label: "مدفوعة جزئيًا" },
  { value: "unpaid", label: "غير مدفوعة" },
];

const todayInRiyadh = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const validVatNumber = (value: string) => /^3\d{13}3$/.test(value);

export function ManualPurchasePage() {
  const navigate = useNavigate();
  const [supplierName, setSupplierName] = useState("");
  const [supplierVatNumber, setSupplierVatNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayInRiyadh);
  const [totalValue, setTotalValue] = useState("");
  const [automaticTax, setAutomaticTax] = useState(true);
  const [manualTaxValue, setManualTaxValue] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const total = Number(totalValue);
  const automatic = calculateIncludedVat(total);
  const taxTotal = automaticTax ? automatic.tax : Number(manualTaxValue);
  const subtotal = Number.isFinite(total - taxTotal)
    ? Math.max(0, Math.round((total - taxTotal) * 100) / 100)
    : 0;
  const partialAmount = Number(paidAmount);
  const validPartialAmount = partialAmount > 0 && partialAmount < total;
  const validPayment =
    paymentStatus === "unpaid" ||
    Boolean(
      paymentStatus &&
      paymentMethod &&
      (paymentStatus === "paid" || validPartialAmount) &&
      (paymentMethod !== "sadad" || paymentReference.trim())
    );
  const validTax = Number.isFinite(taxTotal) && taxTotal >= 0 && taxTotal <= total;
  const canSave = Boolean(
    supplierName.trim() &&
    validVatNumber(supplierVatNumber) &&
    invoiceNumber.trim() &&
    invoiceDate &&
    total > 0 &&
    validTax &&
    paymentStatus &&
    validPayment &&
    confirmed
  );

  function choosePaymentStatus(status: PaymentStatus) {
    setPaymentStatus(status);
    setPaymentMethod("");
    setPaidAmount("");
    setPaymentReference("");
  }

  async function save(override = false) {
    if (!canSave || !paymentStatus) return;
    setSaving(true);
    setError("");
    try {
      const initialPayment =
        paymentStatus === "unpaid"
          ? undefined
          : {
              amount: paymentStatus === "paid" ? total : partialAmount,
              payment_method: paymentMethod as PaymentMethod,
              reference_number: paymentReference.trim() || undefined,
            };
      await createTaxPurchase({
        source: "manual",
        supplier_name: supplierName.trim(),
        supplier_vat_number: supplierVatNumber,
        invoice_number: invoiceNumber.trim(),
        invoice_timestamp: manualInvoiceTimestamp(invoiceDate),
        total,
        tax_total: taxTotal,
        qr_fields: {},
        duplicate_override: override,
        responsibility_confirmed: true,
        payment_status: paymentStatus,
        initial_payment: initialPayment,
      });
      await navigate({ to: "/purchases" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "تعذر حفظ فاتورة المشتريات";
      if (message === "DUPLICATE_WARNING") setDuplicateWarning(true);
      else setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6" dir="rtl">
      <div className="flex items-start gap-3">
        <Button asChild size="icon" variant="ghost">
          <Link to="/purchases" aria-label="العودة إلى المشتريات">
            <ArrowRight />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">إدخال فاتورة مشتريات يدويًا</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            استخدمها عندما تكون فاتورة المورد صحيحة ولا تحتوي على QR قابل للمسح.
          </p>
        </div>
      </div>
      {error ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FilePenLine className="size-5" />
            بيانات الفاتورة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم المورد *" id="manual-supplier-name">
              <Input
                id="manual-supplier-name"
                value={supplierName}
                onChange={(event) => {
                  setSupplierName(event.target.value);
                }}
                placeholder="الاسم كما يظهر في الفاتورة"
              />
            </Field>
            <Field label="الرقم الضريبي للمورد *" id="manual-supplier-vat">
              <Input
                id="manual-supplier-vat"
                inputMode="numeric"
                dir="ltr"
                maxLength={15}
                value={supplierVatNumber}
                onChange={(event) => {
                  setSupplierVatNumber(event.target.value.replace(/\D/g, "").slice(0, 15));
                }}
                placeholder="3XXXXXXXXXXXXX3"
              />
              {supplierVatNumber && !validVatNumber(supplierVatNumber) ? (
                <p className="text-destructive mt-1 text-xs">
                  يجب أن يتكون من 15 رقمًا ويبدأ وينتهي بالرقم 3.
                </p>
              ) : null}
            </Field>
            <Field label="رقم فاتورة المورد *" id="manual-invoice-number">
              <Input
                id="manual-invoice-number"
                dir="ltr"
                value={invoiceNumber}
                onChange={(event) => {
                  setInvoiceNumber(event.target.value);
                }}
                placeholder="INV-001"
              />
            </Field>
            <Field label="تاريخ الفاتورة *" id="manual-invoice-date">
              <Input
                id="manual-invoice-date"
                type="date"
                dir="ltr"
                value={invoiceDate}
                onChange={(event) => {
                  setInvoiceDate(event.target.value);
                }}
              />
            </Field>
            <Field label="إجمالي الفاتورة شامل الضريبة *" id="manual-total">
              <Input
                id="manual-total"
                type="number"
                min="0.01"
                step="0.01"
                dir="ltr"
                value={totalValue}
                onChange={(event) => {
                  setTotalValue(event.target.value);
                }}
                placeholder="0.00"
              />
            </Field>
          </div>

          <section
            className="bg-muted/20 space-y-4 rounded-xl border p-4"
            aria-labelledby="manual-tax-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="manual-tax-title" className="flex items-center gap-2 font-semibold">
                  <Calculator className="size-4" />
                  الضريبة
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  نقترح ضريبة 15% من الإجمالي الشامل، ثم تراجعها مع المبلغ المكتوب في الفاتورة.
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={automaticTax}
                  onChange={(event) => {
                    setAutomaticTax(event.target.checked);
                    if (!event.target.checked) setManualTaxValue(String(automatic.tax));
                  }}
                />
                احتساب تلقائي 15%
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Summary label="الإجمالي" value={total > 0 ? formatCurrency(total) : "—"} />
              <div>
                <Label htmlFor="manual-tax-total">قيمة الضريبة كما في الفاتورة</Label>
                <Input
                  id="manual-tax-total"
                  className="mt-1"
                  type="number"
                  min="0"
                  max={total || undefined}
                  step="0.01"
                  dir="ltr"
                  readOnly={automaticTax}
                  value={automaticTax ? (total > 0 ? String(automatic.tax) : "") : manualTaxValue}
                  onChange={(event) => {
                    setManualTaxValue(event.target.value);
                  }}
                  placeholder="0.00"
                />
              </div>
              <Summary
                label="قبل الضريبة"
                value={total > 0 && validTax ? formatCurrency(subtotal) : "—"}
              />
            </div>
            {!automaticTax ? (
              <p className="text-xs text-amber-800">
                أدخل مبلغ الضريبة المطبوع فعليًا. استخدم صفرًا إذا كانت الفاتورة لا تحمل ضريبة
                مدخلات.
              </p>
            ) : null}
            {total > 0 && taxTotal === 0 ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                ستبقى العملية ضمن المشتريات، لكن لن تضيف ضريبة مدخلات إلى الإقرار.
              </p>
            ) : null}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">حالة السداد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {paymentStatuses.map((status) => (
              <label
                key={status.value}
                className={`cursor-pointer rounded-lg border p-3 text-center transition-colors ${paymentStatus === status.value ? "border-primary bg-primary/5 ring-primary ring-1" : "hover:bg-muted/40"}`}
              >
                <input
                  type="radio"
                  name="manual-payment-status"
                  className="sr-only"
                  checked={paymentStatus === status.value}
                  onChange={() => {
                    choosePaymentStatus(status.value);
                  }}
                />
                <span className="font-medium">{status.label}</span>
              </label>
            ))}
          </div>
          {paymentStatus && paymentStatus !== "unpaid" ? (
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              {paymentStatus === "partially_paid" ? (
                <Field label="المبلغ المدفوع *" id="manual-paid-amount">
                  <Input
                    id="manual-paid-amount"
                    type="number"
                    min="0.01"
                    max={total || undefined}
                    step="0.01"
                    dir="ltr"
                    value={paidAmount}
                    onChange={(event) => {
                      setPaidAmount(event.target.value);
                    }}
                  />
                  {paidAmount && !validPartialAmount ? (
                    <p className="text-destructive mt-1 text-xs">
                      يجب أن يكون أقل من إجمالي الفاتورة.
                    </p>
                  ) : null}
                </Field>
              ) : (
                <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                  سيُسجل كامل مبلغ الفاتورة كمدفوع.
                </div>
              )}
              <div>
                <Label>طريقة الدفع *</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => {
                    setPaymentMethod(value as PaymentMethod);
                    setPaymentReference("");
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="اختر طريقة الدفع" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod === "sadad" ? (
                <Field label="رقم سداد أو رقم الفاتورة *" id="manual-payment-reference">
                  <Input
                    id="manual-payment-reference"
                    value={paymentReference}
                    onChange={(event) => {
                      setPaymentReference(event.target.value);
                    }}
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <label className="flex items-start gap-3 rounded-xl border p-4 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(event) => {
            setConfirmed(event.target.checked);
          }}
        />
        <span>
          <strong className="flex items-center gap-1">
            <ShieldCheck className="size-4" />
            تأكيد المراجعة
          </strong>
          <span className="text-muted-foreground mt-1 block">
            أؤكد أن الفاتورة صادرة باسم منشأتي، وأن رقم المورد ومبلغ الضريبة مطابقان للمستند الذي
            أحتفظ به.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={() => void save()} disabled={!canSave || saving}>
          {saving ? "جاري الحفظ…" : "حفظ وإدراج في الإقرار"}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/purchases">إلغاء</Link>
        </Button>
      </div>

      {duplicateWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-lg">فاتورة مشابهة مسجلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                يوجد سجل يحمل رقم فاتورة المورد نفسه لهذا الرقم الضريبي. راجع المستند لتجنب تكرار
                المشتريات والضريبة.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => void save(true)} disabled={saving}>
                  الحفظ على مسؤوليتي
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDuplicateWarning(false);
                  }}
                >
                  العودة والمراجعة
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
