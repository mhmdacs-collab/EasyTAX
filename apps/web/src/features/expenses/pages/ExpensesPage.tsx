import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CircleDollarSign, Plus, Trash2, WalletCards } from "lucide-react";
import {
  addExpensePayment,
  createExpense,
  deleteExpense,
  listExpenses,
  type CentralExpense,
  type ExpenseSummary,
  type ExpenseCategory,
  type ExpensePaymentMethod,
} from "@/lib/platform/api";
import { expenseCategories, categoryByValue, financialClassForCategory } from "../lib/categories";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { toast } from "@/shared/hooks/useToast";

const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const today = new Date();
const emptySummary: ExpenseSummary = {
  total: 0,
  paid: 0,
  outstanding: 0,
  direct_costs: 0,
  operating_expenses: 0,
  asset_purchases: 0,
};
const paymentMethods: Array<{ value: ExpensePaymentMethod; label: string }> = [
  { value: "cash", label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "card", label: "شبكة" },
  { value: "sadad", label: "سداد (مدفوعات حكومية)" },
];
const paymentMethodLabel = new Map(paymentMethods.map((method) => [method.value, method.label]));
const normalizeIban = (value: string) => value.replace(/\s+/g, "").toUpperCase();

export function ExpensesPage() {
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [expenses, setExpenses] = useState<CentralExpense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>(emptySummary);
  const [open, setOpen] = useState(false);
  const [settling, setSettling] = useState<CentralExpense>();
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listExpenses(year, month);
      setExpenses(result.expenses);
      setSummary(result.summary);
    } catch (error) {
      toast({
        title: "تعذر تحميل المصروفات",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [year, month]);
  useEffect(() => {
    void load();
  }, [load]);
  const remove = async (id: string) => {
    if (!window.confirm("حذف هذا المصروف؟")) return;
    try {
      await deleteExpense(id);
      await load();
      toast({ title: "تم حذف المصروف", variant: "success" });
    } catch (error) {
      toast({
        title: "تعذر الحذف",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "error",
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المصروفات</h1>
          <p className="text-muted-foreground text-sm">
            سجّل المصروف ببساطة، ويتولى النظام تصنيفه للتقارير المالية.
          </p>
        </div>
        <Button
          onClick={() => {
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="size-4" />
          إضافة مصروف
        </Button>
      </div>
      <div className="flex gap-3">
        <Input
          aria-label="السنة"
          type="number"
          min={2020}
          max={2100}
          className="w-28"
          value={year}
          onChange={(e) => {
            setYear(Number(e.target.value));
          }}
        />
        <Select
          value={String(month)}
          onValueChange={(value) => {
            setMonth(Number(value));
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, index) => (
              <SelectItem key={index + 1} value={String(index + 1)}>
                {new Intl.DateTimeFormat("ar-SA", { month: "long" }).format(
                  new Date(2026, index, 1)
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="إجمالي المصروفات" value={summary.total} />
        <Summary label="المدفوع" value={summary.paid} />
        <Summary label="المستحق" value={summary.outstanding} />
        <Summary label="مشتريات الأصول" value={summary.asset_purchases} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">مصروفات الشهر</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">جاري التحميل...</p>
          ) : expenses.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <WalletCards className="mx-auto mb-3 size-9" />
              <p>لا توجد مصروفات مسجلة لهذه الفترة.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => {
                const remaining = Math.max(0, Number(expense.amount) - Number(expense.paid_amount));
                return (
                  <div
                    key={expense.id}
                    className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[100px_1fr_150px_150px_100px_44px] lg:items-center"
                  >
                    <span className="text-sm" dir="ltr">
                      {expense.expense_date}
                    </span>
                    <div>
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-muted-foreground text-xs">
                        {categoryByValue.get(expense.category)?.label}
                        {expense.supplier_name ? ` · ${expense.supplier_name}` : ""}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p>
                        {expense.payment_status === "paid"
                          ? "مدفوع بالكامل"
                          : expense.payment_status === "unpaid"
                            ? "غير مدفوع"
                            : "مدفوع جزئيًا"}
                      </p>
                      {expense.payment_method ? (
                        <p className="text-muted-foreground text-xs">
                          آخر طريقة: {paymentMethodLabel.get(expense.payment_method)}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <strong dir="ltr">{money.format(Number(expense.amount))} ر.س</strong>
                      {remaining > 0 ? (
                        <p className="text-destructive text-xs" dir="ltr">
                          المتبقي {money.format(remaining)} ر.س
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant={remaining > 0 ? "default" : "outline"}
                      disabled={remaining === 0}
                      onClick={() => {
                        setSettling(expense);
                      }}
                      className="gap-1"
                    >
                      <CircleDollarSign className="size-4" />
                      سداد
                    </Button>
                    <Button
                      aria-label="حذف المصروف"
                      variant="ghost"
                      size="icon"
                      disabled={expense.source_type !== "manual"}
                      onClick={() => {
                        void remove(expense.id);
                      }}
                    >
                      <Trash2 className="text-destructive size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {open ? (
        <ExpenseDialog
          onClose={() => {
            setOpen(false);
          }}
          onSaved={async () => {
            setOpen(false);
            await load();
          }}
        />
      ) : null}
      {settling ? (
        <PaymentDialog
          expense={settling}
          onClose={() => {
            setSettling(undefined);
          }}
          onSaved={async () => {
            setSettling(undefined);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-xl font-bold" dir="ltr">
          {money.format(Number(value))} ر.س
        </p>
      </CardContent>
    </Card>
  );
}

function ExpenseDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [category, setCategory] = useState<ExpenseCategory>("work_costs"),
    [description, setDescription] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"paid" | "unpaid" | "partially_paid">("paid"),
    [paidAmount, setPaidAmount] = useState(""),
    [supplier, setSupplier] = useState(""),
    [beneficiaryIban, setBeneficiaryIban] = useState(""),
    [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>("bank_transfer"),
    [reference, setReference] = useState(""),
    [notes, setNotes] = useState(""),
    [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount),
      numericPaid =
        status === "paid" ? numericAmount : status === "unpaid" ? 0 : Number(paidAmount);
    setSaving(true);
    try {
      await createExpense({
        expense_date: date,
        category,
        financial_class: financialClassForCategory(category),
        description,
        amount: numericAmount,
        payment_status: status,
        paid_amount: numericPaid,
        payment_method: status === "unpaid" ? undefined : paymentMethod,
        supplier_name: supplier,
        beneficiary_iban: beneficiaryIban.trim() ? normalizeIban(beneficiaryIban) : undefined,
        reference_number: reference,
        project_reference: "",
        notes,
      });
      toast({
        title: "تم تسجيل المصروف",
        description: "حُفظ مركزيًا وأصبح ضمن التقارير المالية.",
        variant: "success",
      });
      await onSaved();
    } catch (error) {
      toast({
        title: "تعذر حفظ المصروف",
        description: error instanceof Error ? error.message : "راجع البيانات",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-title"
    >
      <form
        onSubmit={(e) => {
          void submit(e);
        }}
        className="bg-background mx-auto my-6 max-w-2xl space-y-5 rounded-xl p-5 shadow-xl"
      >
        <div>
          <h2 id="expense-title" className="text-xl font-bold">
            إضافة مصروف
          </h2>
          <p className="text-muted-foreground text-sm">
            اختر الوصف الأقرب للعملية، وسنرتب تصنيفها المالي خلفيًا.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {expenseCategories.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setCategory(item.value);
              }}
              className={`rounded-lg border p-3 text-start ${category === item.value ? "border-primary bg-primary/5" : ""}`}
            >
              <span className="block font-medium">{item.label}</span>
              <span className="text-muted-foreground text-xs">{item.description}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="وصف المصروف" required>
            <Input
              required
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              placeholder={category === "payroll" ? "رواتب شهر أغسطس 2026" : "مثال: إيجار المكتب"}
            />
          </Field>
          <Field label="التاريخ" required>
            <Input
              required
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
              }}
            />
          </Field>
          <Field label="المبلغ" required>
            <Input
              required
              type="number"
              min="0.01"
              step="0.01"
              dir="ltr"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
            />
          </Field>
          <Field label="حالة السداد">
            <Select
              value={status}
              onValueChange={(value: "paid" | "unpaid" | "partially_paid") => {
                setStatus(value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">مدفوع بالكامل</SelectItem>
                <SelectItem value="unpaid">غير مدفوع</SelectItem>
                <SelectItem value="partially_paid">مدفوع جزئيًا</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {status === "partially_paid" ? (
            <Field label="المبلغ المدفوع" required>
              <Input
                required
                type="number"
                min="0.01"
                step="0.01"
                dir="ltr"
                value={paidAmount}
                onChange={(e) => {
                  setPaidAmount(e.target.value);
                }}
              />
            </Field>
          ) : null}
          {status !== "unpaid" ? (
            <Field label="طريقة الدفع" required>
              <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
            </Field>
          ) : null}
          <Field label="المورد أو المستفيد">
            <Input
              required={status !== "unpaid"}
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
              }}
            />
          </Field>
          <Field label="آيبان المستفيد (اختياري)">
            <Input
              dir="ltr"
              value={beneficiaryIban}
              onChange={(e) => {
                setBeneficiaryIban(e.target.value);
              }}
              placeholder="SA00 0000 0000 0000 0000 0000"
            />
            <p className="text-xs text-muted-foreground">يُحفظ مع بيانات المستفيد ويظهر تلقائيًا عند أي سداد لاحق.</p>
          </Field>
          <Field
            label={
              paymentMethod === "sadad" && status !== "unpaid"
                ? "رقم سداد أو رقم الفاتورة"
                : "الرقم المرجعي"
            }
          >
            <Input
              required={paymentMethod === "sadad" && status !== "unpaid"}
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
              }}
              dir="ltr"
            />
          </Field>
        </div>
        <Field label="ملاحظات">
          <Textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
          />
        </Field>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={saving}>
            حفظ المصروف
          </Button>
        </div>
      </form>
    </div>
  );
}

function PaymentDialog({
  expense,
  onClose,
  onSaved,
}: {
  expense: CentralExpense;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const remaining = Math.max(0, Number(expense.amount) - Number(expense.paid_amount));
  const [amount, setAmount] = useState(String(remaining)),
    [method, setMethod] = useState<ExpensePaymentMethod>("bank_transfer"),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [beneficiary, setBeneficiary] = useState(expense.supplier_name || ""),
    [iban, setIban] = useState(expense.beneficiary_iban || ""),
    [reference, setReference] = useState(""),
    [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await addExpensePayment(expense.id, {
        amount: Number(amount),
        payment_method: method,
        payment_date: date,
        beneficiary_name: beneficiary,
        beneficiary_iban: iban.trim() ? normalizeIban(iban) : undefined,
        reference_number: reference,
      });
      toast({
        title: "تم تسجيل الدفعة",
        description: "حُدّث المبلغ المتبقي وحالة المصروف.",
        variant: "success",
      });
      await onSaved();
    } catch (error) {
      toast({
        title: "تعذر تسجيل الدفعة",
        description: error instanceof Error ? error.message : "راجع البيانات",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-title"
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="bg-background mx-auto my-10 max-w-lg space-y-4 rounded-xl p-5 shadow-xl"
      >
        <div>
          <h2 id="payment-title" className="text-xl font-bold">
            سداد مصروف
          </h2>
          <p className="text-muted-foreground text-sm">{expense.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">قيمة المصروف</p>
            <p className="mt-1 font-semibold" dir="ltr">
              {money.format(Number(expense.amount))} ر.س
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">المدفوع سابقًا</p>
            <p className="mt-1 font-semibold" dir="ltr">
              {money.format(Number(expense.paid_amount))} ر.س
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm font-medium text-red-700">المبلغ المتبقي</p>
          <p className="mt-1 text-3xl font-extrabold text-red-700" dir="ltr">
            {money.format(remaining)} ر.س
          </p>
        </div>
        <Field label="اسم المستفيد" required>
          <Input
            required
            value={beneficiary}
            onChange={(event) => {
              setBeneficiary(event.target.value);
            }}
          />
        </Field>
        <Field label="مبلغ الدفعة" required>
          <Input
            autoFocus
            required
            type="number"
            min="0.01"
            max={remaining}
            step="0.01"
            dir="ltr"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
          />
        </Field>
        <Field label="طريقة الدفع" required>
          <PaymentMethodSelect value={method} onChange={setMethod} />
        </Field>
        <Field label="آيبان المستفيد (اختياري ومحفوظ للسداد القادم)">
          <div className="flex gap-2">
            <Input
              dir="ltr"
              value={iban}
              onChange={(event) => {
                setIban(event.target.value);
              }}
              placeholder="SA00 0000 0000 0000 0000 0000"
            />
            <Button type="button" variant="outline" disabled={!iban.trim()} onClick={() => { void navigator.clipboard.writeText(normalizeIban(iban)); toast({ title:"تم نسخ الآيبان", variant:"success" }) }}>نسخ</Button>
          </div>
        </Field>
        <Field label="تاريخ الدفع" required>
          <Input
            required
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
            }}
          />
        </Field>
        <Field
          label={method === "sadad" ? "رقم سداد أو رقم الفاتورة" : "رقم المرجع"}
          required={method === "sadad"}
        >
          <Input
            required={method === "sadad"}
            dir="ltr"
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
            }}
          />
        </Field>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={saving}>
            اعتماد السداد
          </Button>
        </div>
      </form>
    </div>
  );
}

function PaymentMethodSelect({
  value,
  onChange,
}: {
  value: ExpensePaymentMethod;
  onChange: (value: ExpensePaymentMethod) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next: ExpensePaymentMethod) => {
        onChange(next);
      }}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {paymentMethods.map((method) => (
          <SelectItem key={method.value} value={method.value}>
            {method.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
    </div>
  );
}
