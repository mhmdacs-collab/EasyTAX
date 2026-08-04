import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Spinner } from "@/shared/components/ui/spinner"
import { Textarea } from "@/shared/components/ui/textarea"
import { cn } from "@/shared/utils"
import { db, type Organization } from "@/lib/db"
import { authClient } from "@/lib/auth/client"
import { completeCustomerOnboarding, fetchCustomerBootstrap } from "@/lib/subscription/api"
import { bindOrganizationToAuthUser } from "@/lib/session/customerSession"

const STEPS = ["المنشأة والأمان", "العنوان والبنك", "الضريبة والدفع", "التواصل والهوية", "المراجعة والتأكيد"]
const REQUIRED = "هذا الحقل مطلوب"
const DEFAULT_TERMS = ["صلاحية عرض السعر 30 يومًا.", "الأسعار لا تشمل أي أعمال إضافية غير مذكورة.", "يبدأ التنفيذ بعد اعتماد العرض."]

type PaymentMethod = { name: string; is_collected: boolean; is_default: boolean; is_active: boolean }

export interface OnboardingData {
  business_name: string
  vat_number: string
  organization_id: string
  country: string
  commercial_registration: string
  phone: string
  email: string
  city: string
  district: string
  street: string
  building_number: string
  postal_code: string
  short_address: string
  new_password: string
  confirm_password: string
  bank_enabled: boolean
  bank_name: string
  bank_account_name: string
  iban: string
  logo_url: string
  stamp_url: string
  signature_url: string
  stamp_on_invoice: boolean
  stamp_on_quotation: boolean
  stamp_on_receipt: boolean
  signature_on_invoice: boolean
  signature_on_quotation: boolean
  signature_on_receipt: boolean
  prices_include_tax?: boolean
  retention_enabled: boolean
  payment_methods: PaymentMethod[]
  quotation_terms: string[]
}

const initialData: OnboardingData = {
  business_name: "", vat_number: "", organization_id: "", country: "المملكة العربية السعودية",
  commercial_registration: "", phone: "", email: "", city: "", district: "", street: "",
  building_number: "", postal_code: "", short_address: "", new_password: "", confirm_password: "",
  bank_enabled: false, bank_name: "", bank_account_name: "", iban: "", logo_url: "", stamp_url: "", signature_url: "",
  stamp_on_invoice: false, stamp_on_quotation: false, stamp_on_receipt: false,
  signature_on_invoice: false, signature_on_quotation: false, signature_on_receipt: false,
  retention_enabled: false,
  payment_methods: [
    { name: "نقدًا", is_collected: true, is_default: true, is_active: true },
    { name: "بطاقة بنكية", is_collected: true, is_default: true, is_active: true },
    { name: "تحويل بنكي", is_collected: true, is_default: true, is_active: true },
  ],
  quotation_terms: [],
}

function Field({ label, name, value, error, onChange, type = "text", placeholder, optional = false, disabled = false, description }: {
  label: string; name: string; value: string; error?: string; onChange: (value: string) => void
  type?: string; placeholder?: string; optional?: boolean; disabled?: boolean; description?: string
}) {
  return <div className="space-y-2">
    <Label htmlFor={name}>{label}{optional ? " (اختياري)" : disabled ? "" : " *"}</Label>
    {description && <p className="text-xs leading-5 text-muted-foreground">{description}</p>}
    <Input id={name} type={type} value={value} disabled={disabled} placeholder={placeholder} dir={type === "text" ? "auto" : "ltr"}
      className={cn(error && "border-destructive focus-visible:ring-destructive")}
      onChange={(event) => { onChange(event.target.value); }} />
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
    <input type="checkbox" checked={checked} onChange={(event) => { onChange(event.target.checked); }} className="mt-1 h-4 w-4" />
    <span><span className="block text-sm font-medium">{label}</span>{description && <span className="text-xs text-muted-foreground">{description}</span>}</span>
  </label>
}

async function pngToDataUrl(file: File): Promise<string> {
  if (file.type !== "image/png") throw new Error("يسمح بملفات PNG فقط")
  if (file.size > 2 * 1024 * 1024) throw new Error("حجم الملف يجب ألا يتجاوز 2MB")
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("تعذر قراءة الملف"))
    }
    reader.onerror = () => { reject(new Error("تعذر قراءة الملف")); }
    reader.readAsDataURL(file)
  })
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [data, setData] = useState(initialData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fatalError, setFatalError] = useState("")
  const [customMethod, setCustomMethod] = useState("")
  const [assetError, setAssetError] = useState("")
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [originalPhone, setOriginalPhone] = useState("")

  useEffect(() => {
    void fetchCustomerBootstrap().then((bootstrap) => {
      const organization = bootstrap.organization
      setOriginalPhone(organization.phone ?? "")
      setData((current) => ({ ...current,
        business_name: organization.business_name, vat_number: organization.vat_number,
        organization_id: organization.id, country: "المملكة العربية السعودية",
        commercial_registration: organization.commercial_registration ?? "", phone: organization.phone ?? "",
        email: organization.email ?? "", city: organization.city ?? "", district: organization.district ?? "",
        street: organization.street ?? "", building_number: organization.building_number ?? "",
        postal_code: organization.postal_code ?? "", short_address: organization.short_address ?? "",
        bank_enabled: organization.bank_enabled, bank_name: organization.bank_name ?? "",
        bank_account_name: organization.bank_account_name ?? "", iban: organization.iban ?? "",
        logo_url: organization.logo_url ?? "", stamp_url: organization.stamp_url ?? "",
        signature_url: organization.signature_url ?? "", stamp_on_invoice: organization.stamp_on_invoice,
        stamp_on_quotation: organization.stamp_on_quotation, stamp_on_receipt: organization.stamp_on_receipt,
        signature_on_invoice: organization.signature_on_invoice, signature_on_quotation: organization.signature_on_quotation,
        signature_on_receipt: organization.signature_on_receipt, prices_include_tax: organization.prices_include_tax ?? undefined,
        retention_enabled: organization.retention_enabled,
      }))
    }).catch(() => { setFatalError("تعذر تحميل بيانات المنشأة. حاول تسجيل الدخول مرة أخرى."); }).finally(() => { setLoading(false); })
  }, [])

  const progress = `${Math.round(((step + 1) / STEPS.length) * 100)}%`
  const set = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((current) => ({ ...current, [key]: value }))
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== key)))
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (step === 0) {
      if (!data.commercial_registration.trim()) next.commercial_registration = REQUIRED
      if (!data.new_password) next.new_password = REQUIRED
      else if (data.new_password.length < 8) next.new_password = "كلمة المرور يجب ألا تقل عن 8 أحرف"
      if (!data.confirm_password) next.confirm_password = REQUIRED
      else if (data.confirm_password !== data.new_password) next.confirm_password = "كلمتا المرور غير متطابقتين"
    }
    if (step === 1) {
      if (!data.city.trim()) next.city = REQUIRED
      if (!data.district.trim()) next.district = REQUIRED
      if (!data.street.trim()) next.street = REQUIRED
      if (data.bank_enabled) {
        if (!data.bank_name.trim()) next.bank_name = REQUIRED
        if (!data.bank_account_name.trim()) next.bank_account_name = REQUIRED
        if (!data.iban.trim()) next.iban = REQUIRED
      }
    }
    if (step === 2 && data.prices_include_tax === undefined) next.prices_include_tax = REQUIRED
    if (step === 3 && data.email && !/^\S+@\S+\.\S+$/.test(data.email)) next.email = "البريد الإلكتروني غير صالح"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const next = () => { if (validate()) setStep((current) => Math.min(current + 1, STEPS.length - 1)) }
  const back = () => { setErrors({}); setStep((current) => Math.max(current - 1, 0)) }

  const upload = async (key: "logo_url" | "stamp_url" | "signature_url", file?: File) => {
    if (!file) return
    try { setAssetError(""); set(key, await pngToDataUrl(file)) } catch (error) { setAssetError(error instanceof Error ? error.message : "ملف غير صالح") }
  }

  const moveTerm = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= data.quotation_terms.length) return
    const terms = [...data.quotation_terms]
    const current = terms[index]
    const adjacent = terms[target]
    if (current === undefined || adjacent === undefined) return
    terms[index] = adjacent
    terms[target] = current
    set("quotation_terms", terms)
  }

  const finish = async () => {
    setSaving(true); setFatalError("")
    try {
      if (!passwordChanged) {
        const result = await authClient.changePassword({ currentPassword: originalPhone, newPassword: data.new_password, revokeOtherSessions: false })
        if (result.error) throw new Error(result.error.message || "تعذر تغيير كلمة المرور")
        setPasswordChanged(true)
      }
      await completeCustomerOnboarding({
        commercial_registration: data.commercial_registration, phone: data.phone, email: data.email,
        city: data.city, district: data.district, street: data.street, building_number: data.building_number,
        postal_code: data.postal_code, short_address: data.short_address, bank_enabled: data.bank_enabled,
        bank_name: data.bank_name, bank_account_name: data.bank_account_name, iban: data.iban,
        logo_url: data.logo_url, stamp_url: data.stamp_url, signature_url: data.signature_url,
        stamp_on_invoice: data.stamp_on_invoice, stamp_on_quotation: data.stamp_on_quotation,
        stamp_on_receipt: data.stamp_on_receipt, signature_on_invoice: data.signature_on_invoice,
        signature_on_quotation: data.signature_on_quotation, signature_on_receipt: data.signature_on_receipt,
        prices_include_tax: data.prices_include_tax as boolean, retention_enabled: data.retention_enabled,
        payment_methods: data.payment_methods, quotation_terms: data.quotation_terms, password_changed: true,
      })
      const session = await authClient.getSession()
      const authUserId = session.data?.user.id
      if (!authUserId) throw new Error("انتهت جلسة الدخول")
      const now = new Date().toISOString()
      const organization: Organization = {
        id: data.organization_id, auth_user_id: authUserId, business_name: data.business_name,
        vat_number: data.vat_number, commercial_registration: data.commercial_registration, phone: data.phone,
        email: data.email, city: data.city, district: data.district, street: data.street,
        building_number: data.building_number, postal_code: data.postal_code, short_address: data.short_address,
        logo_url: data.logo_url, stamp_url: data.stamp_url, signature_url: data.signature_url,
        bank_enabled: data.bank_enabled, bank_name: data.bank_name, bank_account_name: data.bank_account_name,
        iban: data.iban, prices_include_tax: data.prices_include_tax, retention_enabled: data.retention_enabled,
        payment_methods: data.payment_methods, quotation_terms: data.quotation_terms,
        stamp_on_invoice: data.stamp_on_invoice, stamp_on_quotation: data.stamp_on_quotation,
        stamp_on_receipt: data.stamp_on_receipt, signature_on_invoice: data.signature_on_invoice,
        signature_on_quotation: data.signature_on_quotation, signature_on_receipt: data.signature_on_receipt,
        subscription_status: "active", created_at: now, updated_at: now, sync_status: "synced", version: 1,
      }
      await db.organizations.put(organization)
      await bindOrganizationToAuthUser(organization.id, authUserId)
      await navigate({ to: "/" })
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "تعذر إكمال الإعداد")
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner size="lg" /></div>
  if (fatalError && !data.organization_id) return <div className="flex min-h-screen items-center justify-center p-6 text-destructive">{fatalError}</div>

  return <div className="min-h-screen bg-muted/30 p-4 py-8" dir="rtl">
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">ET</div>
        <h1 className="text-2xl font-bold">إعدادات أول دخول</h1><p className="text-sm text-muted-foreground">أكمل الأقسام التالية لتفعيل حساب منشأتك</p></header>
      <div className="space-y-2"><div className="flex justify-between text-xs"><span>الخطوة {step + 1} من {STEPS.length}: {STEPS[step]}</span><span>{progress}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: progress }} /></div>
        <div className="hidden justify-between text-[11px] text-muted-foreground sm:flex">{STEPS.map((name, index) => <span key={name} className={cn(index === step && "font-bold text-primary")}>{name}</span>)}</div></div>

      <main className="rounded-xl border bg-card p-5 shadow-sm sm:p-8">
        {step === 0 && <section className="space-y-6">
          <div><h2 className="text-lg font-semibold">بيانات المنشأة والأمان</h2><p className="text-sm leading-6 text-muted-foreground">تأكد من بيانات اشتراكك، ثم أنشئ كلمة مرور جديدة بدل كلمة المرور المؤقتة.</p></div>
          <Field label="اسم النشاط" name="business_name" value={data.business_name} onChange={() => undefined} disabled description="اسم النشاط مسجل من لوحة الإدارة، ويظهر في مستندات المنشأة ولا يمكن تغييره من هنا." />
          <Field label="الرقم الضريبي" name="vat_number" value={data.vat_number} onChange={() => undefined} disabled description="الرقم الضريبي هو اسم المستخدم للدخول، وهو مرتبط بالاشتراك ولا يمكن تعديله." />
          <Field label="رقم السجل التجاري" name="commercial_registration" value={data.commercial_registration} error={errors.commercial_registration} onChange={(value) => { set("commercial_registration", value); }} placeholder="1010123456" description="أدخل رقم السجل التجاري الرسمي للمنشأة؛ سيظهر ضمن بياناتها القانونية." />
          <Field label="الدولة" name="country" value={data.country} onChange={() => undefined} disabled description="النظام مهيأ حاليًا للمنشآت داخل المملكة العربية السعودية." />
          <Field label="معرف النظام" name="organization_id" value={data.organization_id} onChange={() => undefined} disabled description="معرف فريد ينشئه النظام لربط جميع بيانات وفواتير منشأتك. احتفظ به عند التواصل مع الدعم." />
          <div className="border-t pt-6"><h3 className="mb-1 font-semibold">بيانات الدخول الجديدة</h3><p className="mb-5 text-sm leading-6 text-muted-foreground">اختر كلمة مرور خاصة بك لا تقل عن 8 أحرف. بعد الحفظ لن تعمل كلمة المرور المؤقتة.</p>
            <div className="space-y-5"><Field label="كلمة المرور الجديدة" name="new_password" type="password" value={data.new_password} error={errors.new_password} onChange={(value) => { set("new_password", value); }} />
              <Field label="تأكيد كلمة المرور" name="confirm_password" type="password" value={data.confirm_password} error={errors.confirm_password} onChange={(value) => { set("confirm_password", value); }} /></div></div>
        </section>}

        {step === 1 && <section className="space-y-6">
          <div><h2 className="text-lg font-semibold">العنوان والحساب البنكي للمنشأة</h2><p className="text-sm leading-6 text-muted-foreground">تُستخدم بيانات العنوان في رأس الفواتير والمستندات الرسمية. المدينة والحي والشارع حقول إلزامية.</p></div>
          <Field label="العنوان الوطني المختصر" name="short_address" value={data.short_address} optional onChange={(value) => { set("short_address", value); }} description="رمز العنوان المختصر المكون عادة من 4 أحرف و4 أرقام، مثل RRRD2929." />
          <Field label="المدينة" name="city" value={data.city} error={errors.city} onChange={(value) => { set("city", value); }} />
          <Field label="الحي" name="district" value={data.district} error={errors.district} onChange={(value) => { set("district", value); }} />
          <Field label="اسم الشارع" name="street" value={data.street} error={errors.street} onChange={(value) => { set("street", value); }} />
          <div className="grid gap-4 sm:grid-cols-2"><Field label="رقم المبنى" name="building_number" value={data.building_number} optional onChange={(value) => { set("building_number", value); }} />
            <Field label="الرمز البريدي" name="postal_code" value={data.postal_code} optional onChange={(value) => { set("postal_code", value); }} /></div>
          <div className="border-t pt-6"><h3 className="mb-3 font-semibold">بيانات الحساب البنكي</h3>
            <Toggle checked={data.bank_enabled} onChange={(value) => { set("bank_enabled", value); }} label="إضافة حساب بنكي للمنشأة" description="فعّل هذا الخيار إذا أردت إظهار بيانات التحويل البنكي في المستندات عند الحاجة." />
            {data.bank_enabled && <div className="mt-5 space-y-5 rounded-lg border p-4"><Field label="اسم البنك" name="bank_name" value={data.bank_name} error={errors.bank_name} onChange={(value) => { set("bank_name", value); }} />
              <Field label="اسم المستفيد" name="bank_account_name" value={data.bank_account_name} error={errors.bank_account_name} onChange={(value) => { set("bank_account_name", value); }} description="الاسم المسجل رسميًا لدى البنك لصاحب الحساب." />
              <Field label="رقم الآيبان" name="iban" value={data.iban} error={errors.iban} onChange={(value) => { set("iban", value); }} description="أدخل الآيبان السعودي كاملًا ويبدأ بالحرفين SA." /></div>}</div>
        </section>}

        {step === 2 && <section className="space-y-7">
          <div><h2 className="text-lg font-semibold">الضريبة وطرق الدفع</h2><p className="text-sm leading-6 text-muted-foreground">تحدد هذه الاختيارات طريقة حساب الفواتير وتصنيف المبالغ المدفوعة والمستحقة.</p></div>
          <div className="space-y-3"><h3 className="font-semibold">طريقة احتساب ضريبة القيمة المضافة 15% للأسعار</h3><p className="text-sm leading-6 text-muted-foreground">اختر «شاملة» إذا كان السعر الذي تدخله يتضمن الضريبة بالفعل، أو «غير شاملة» ليضيف النظام 15% إلى السعر.</p>
            <div className={cn("grid gap-3 rounded-lg border p-4 sm:grid-cols-2", errors.prices_include_tax && "border-destructive")}><Toggle checked={data.prices_include_tax === true} onChange={() => { set("prices_include_tax", true); }} label="الأسعار شاملة الضريبة" /><Toggle checked={data.prices_include_tax === false} onChange={() => { set("prices_include_tax", false); }} label="الأسعار غير شاملة الضريبة" />{errors.prices_include_tax && <p className="text-xs text-destructive sm:col-span-2">{errors.prices_include_tax}</p>}</div></div>
          <div className="space-y-3 border-t pt-6"><h3 className="font-semibold">نسبة ضمان الأعمال</h3><Toggle checked={data.retention_enabled} onChange={(value) => { set("retention_enabled", value); }} label="تفعيل حجز ضمان الأعمال" description="عند التفعيل يظهر حقل نسبة ضمان لكل بند في الفاتورة، وتكون النسبة الافتراضية صفر. تختار داخل الفاتورة هل يُحسب الحجز قبل الضريبة أو من الإجمالي شامل الضريبة." /></div>
          <div className="space-y-3 border-t pt-6"><div><h3 className="font-semibold">طرق السداد</h3><p className="text-sm leading-6 text-muted-foreground">«مدفوعة» تعني أن المبلغ المسجل بهذه الطريقة يُخصم من المبلغ المستحق. يمكنك تعطيل أي طريقة دون حذفها.</p></div>
            {data.payment_methods.map((method, index) => <div key={`${method.name}-${index}`} className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <span className="font-medium">{method.name}</span><Toggle checked={method.is_active} onChange={(value) => { set("payment_methods", data.payment_methods.map((item, i) => i === index ? {...item,is_active:value}:item)); }} label="مفعلة" />
              <Toggle checked={method.is_collected} onChange={(value) => { set("payment_methods", data.payment_methods.map((item, i) => i === index ? {...item,is_collected:value}:item)); }} label="مدفوعة" />
              {!method.is_default && <Button type="button" size="sm" variant="ghost" onClick={() => { set("payment_methods", data.payment_methods.filter((_, i) => i !== index)); }}><Trash2 className="h-4 w-4" /></Button>}</div>)}
            <div className="flex gap-2"><Input value={customMethod} placeholder="طريقة مخصصة، مثل محفظة أو شيك" onChange={(event) => { setCustomMethod(event.target.value); }} /><Button type="button" variant="outline" onClick={() => { const name=customMethod.trim(); if(name && !data.payment_methods.some((m)=>m.name===name)){set("payment_methods",[...data.payment_methods,{name,is_collected:true,is_default:false,is_active:true}]);setCustomMethod("")}}}><Plus className="h-4 w-4" /> إضافة</Button></div></div>
        </section>}

        {step === 3 && <section className="space-y-7">
          <div><h2 className="text-lg font-semibold">بيانات التواصل وشعار المنشأة</h2><p className="text-sm leading-6 text-muted-foreground">هذه البيانات اختيارية، لكنها تساعدك على إرسال المستندات وإظهار هوية منشأتك بصورة احترافية.</p></div>
          <Field label="رقم الجوال" name="phone" value={data.phone} optional onChange={(value) => { set("phone", value); }} description="يُستخدم للتواصل وإرسال الفواتير والمستندات مباشرة إلى العملاء عند تفعيل خدمات الإرسال." />
          <Field label="البريد الإلكتروني" name="email" type="email" value={data.email} error={errors.email} optional onChange={(value) => { set("email", value); }} description="يُستخدم كعنوان إرسال للفواتير وعروض الأسعار والإشعارات إلى العملاء." />
          <div className="space-y-3 border-t pt-6"><h3 className="font-semibold">شعار المنشأة</h3><p className="text-sm leading-6 text-muted-foreground">يظهر الشعار في جميع المستندات الصادرة. الملف يجب أن يكون بصيغة PNG وبحجم لا يتجاوز 2MB.</p><Input type="file" accept="image/png" onChange={(event) => void upload("logo_url", event.target.files?.[0])} />{data.logo_url && <img src={data.logo_url} alt="الشعار" className="h-24 w-full rounded-lg border object-contain p-2" />}</div>
          <div className="space-y-3 border-t pt-6"><h3 className="font-semibold">الختم</h3><p className="text-sm leading-6 text-muted-foreground">الختم اختياري وليس شرطًا لصحة الفاتورة. بعد رفعه يمكنك تحديد المستندات التي يظهر فيها.</p><Input type="file" accept="image/png" onChange={(event) => void upload("stamp_url", event.target.files?.[0])} />{data.stamp_url && <><img src={data.stamp_url} alt="الختم" className="h-24 w-full rounded-lg border object-contain p-2" /><div className="grid gap-2 sm:grid-cols-3"><Toggle checked={data.stamp_on_invoice} onChange={(v) => { set("stamp_on_invoice", v); }} label="الفاتورة الضريبية" /><Toggle checked={data.stamp_on_quotation} onChange={(v) => { set("stamp_on_quotation", v); }} label="عرض السعر" /><Toggle checked={data.stamp_on_receipt} onChange={(v) => { set("stamp_on_receipt", v); }} label="سند القبض" /></div></>}</div>
          <div className="space-y-3 border-t pt-6"><h3 className="font-semibold">التوقيع</h3><p className="text-sm leading-6 text-muted-foreground">التوقيع اختياري، ويمكن إظهاره أو إخفاؤه بصورة مستقلة لكل نوع مستند.</p><Input type="file" accept="image/png" onChange={(event) => void upload("signature_url", event.target.files?.[0])} />{data.signature_url && <><img src={data.signature_url} alt="التوقيع" className="h-24 w-full rounded-lg border object-contain p-2" /><div className="grid gap-2 sm:grid-cols-3"><Toggle checked={data.signature_on_invoice} onChange={(v) => { set("signature_on_invoice", v); }} label="الفاتورة الضريبية" /><Toggle checked={data.signature_on_quotation} onChange={(v) => { set("signature_on_quotation", v); }} label="عرض السعر" /><Toggle checked={data.signature_on_receipt} onChange={(v) => { set("signature_on_receipt", v); }} label="سند القبض" /></div></>}</div>
          {assetError && <p className="text-sm text-destructive">{assetError}</p>}
          <div className="space-y-3 border-t pt-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">شروط وأحكام عروض الأسعار</h3><p className="text-sm leading-6 text-muted-foreground">تحفظ الشروط كبنود منفصلة قابلة للترتيب. لا تظهر تلقائيًا؛ تختار إضافتها عند إنشاء عرض السعر، ويمكن تعديل نسخة العرض دون تغيير القالب الأصلي.</p></div><Button type="button" variant="outline" size="sm" onClick={() => { set("quotation_terms", [...DEFAULT_TERMS]); }}>استخدام القالب الافتراضي</Button></div>
            {data.quotation_terms.map((term,index)=><div key={index} className="flex gap-2"><Textarea value={term} rows={2} onChange={(event)=>{ set("quotation_terms",data.quotation_terms.map((item,i)=>i===index?event.target.value:item)); }}/><div className="flex flex-col"><Button type="button" size="sm" variant="ghost" disabled={index===0} onClick={()=>{ moveTerm(index,-1); }}><ArrowUp className="h-4 w-4"/></Button><Button type="button" size="sm" variant="ghost" disabled={index===data.quotation_terms.length-1} onClick={()=>{ moveTerm(index,1); }}><ArrowDown className="h-4 w-4"/></Button><Button type="button" size="sm" variant="ghost" onClick={()=>{ set("quotation_terms",data.quotation_terms.filter((_,i)=>i!==index)); }}><Trash2 className="h-4 w-4"/></Button></div></div>)}
            <Button type="button" variant="outline" size="sm" onClick={()=>{ set("quotation_terms",[...data.quotation_terms,""]); }}><Plus className="h-4 w-4"/> إضافة بند</Button></div>
        </section>}

        {step === 4 && <section className="space-y-6"><div><h2 className="text-lg font-semibold">مراجعة وتأكيد البيانات</h2><p className="text-sm leading-6 text-muted-foreground">راجع الملخص قبل التفعيل. يمكنك تعديل البيانات القابلة للتعديل لاحقًا من صفحة الإعدادات.</p></div>
          <div className="space-y-3 rounded-lg border p-4 text-sm"><p><span className="text-muted-foreground">المنشأة:</span> <strong>{data.business_name}</strong></p><p><span className="text-muted-foreground">الرقم الضريبي:</span> {data.vat_number}</p><p><span className="text-muted-foreground">السجل التجاري:</span> {data.commercial_registration}</p><p><span className="text-muted-foreground">العنوان:</span> {data.city}، {data.district}، {data.street}</p><p><span className="text-muted-foreground">الحساب البنكي:</span> {data.bank_enabled ? `${data.bank_name} — ${data.iban}` : "غير مضاف"}</p><p><span className="text-muted-foreground">احتساب الضريبة:</span> {data.prices_include_tax ? "الأسعار شاملة الضريبة" : "الأسعار غير شاملة الضريبة"}</p><p><span className="text-muted-foreground">طرق السداد المفعلة:</span> {data.payment_methods.filter((method)=>method.is_active).map((method)=>method.name).join("، ")}</p></div>
          <div className="rounded-lg bg-primary/5 p-4 text-sm leading-6"><strong>ماذا يحدث عند التأكيد؟</strong><p>سيتم تغيير كلمة المرور المؤقتة، وحفظ إعدادات المنشأة مركزيًا، ثم تفعيل الحساب وفتح الشاشة الرئيسية. ويمكنك تعديل البيانات غير الثابتة لاحقًا من الإعدادات.</p></div>
          {fatalError && <p className="rounded-lg border border-destructive bg-destructive/5 p-3 text-sm text-destructive">{fatalError}</p>}
        </section>}

        <div className="mt-8 flex gap-3"><Button type="button" variant="outline" onClick={back} disabled={step===0 || saving} className="flex-1">رجوع</Button>
          {step < STEPS.length - 1 ? <Button type="button" onClick={next} className="flex-1">التالي</Button> : <Button type="button" loading={saving} onClick={() => void finish()} className="flex-1">حفظ وتفعيل الحساب</Button>}</div>
      </main>
    </div>
  </div>
}
