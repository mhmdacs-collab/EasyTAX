import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { Download, Mail, MessageCircle, Printer, Share2 } from "lucide-react"
import { fetchBrandingAssetUrl, fetchReceipt, type BrandingAssetKind, type CentralReceipt } from "@/lib/platform/api"
import { createInvoicePdf, downloadPdf, sharePdf } from "@/lib/pdf/invoicePdf"
import { Button } from "@/shared/components/ui/button"
import { Separator } from "@/shared/components/ui/separator"
import { toast } from "@/shared/hooks/useToast"
import { formatCurrency, formatDate } from "@/shared/utils"

type OrganizationSnapshot={business_name?:string;vat_number?:string;commercial_registration?:string;phone?:string;email?:string;city?:string;district?:string;street?:string;building_number?:string;postal_code?:string}

export function ReceiptViewPage(){
  const{id}=useParams({from:"/app/receipts/$id"})
  const[receipt,setReceipt]=useState<CentralReceipt>(),[creatingPdf,setCreatingPdf]=useState(false),[assets,setAssets]=useState<Partial<Record<BrandingAssetKind,string>>>({})
  const printRef=useRef<HTMLElement>(null)
  useEffect(()=>{void fetchReceipt(id).then((result)=>{setReceipt(result.receipt)}).catch((error:unknown)=>{toast({title:"تعذر تحميل سند القبض",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})})},[id])
  useEffect(()=>{void Promise.all((['logo','stamp','signature'] as const).map(async(kind)=>{const url=await fetchBrandingAssetUrl(kind);if(url)setAssets((current)=>({...current,[kind]:url}))}))},[])
  if(!receipt)return <p className="p-6 text-muted-foreground">جاري تحميل سند القبض...</p>
  const seller=receipt.organization_snapshot as OrganizationSnapshot
  const sellerAddress=[seller.street,seller.building_number,seller.district,seller.city,seller.postal_code].filter(Boolean).join("، ")
  const fileName=`receipt-${receipt.number}.pdf`,organizationName=seller.business_name??"المنشأة"
  const message=`السلام عليكم ورحمة الله وبركاته،\n\nيسر ${organizationName} تزويدكم بسند القبض رقم ${receipt.number} بتاريخ ${formatDate(receipt.receipt_date)} بمبلغ ${formatCurrency(Number(receipt.amount))}.\n\nمع خالص التحية،\n${organizationName}`
  const emailUrl=receipt.payer_email?`mailto:${receipt.payer_email}?subject=${encodeURIComponent(`سند قبض رقم ${receipt.number}`)}&body=${encodeURIComponent(message)}`:""
  const whatsappPhone=receipt.payer_phone?.replace(/\D/g,"").replace(/^0/,"966")??""
  const whatsappUrl=whatsappPhone?`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`:""
  const makePdf=async()=>{if(!printRef.current)throw new Error("تعذر تجهيز سند القبض");return createInvoicePdf(printRef.current)}
  const download=async()=>{setCreatingPdf(true);try{downloadPdf(await makePdf(),fileName)}catch(error){toast({title:"تعذر إنشاء PDF",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}finally{setCreatingPdf(false)}}
  const nativeShare=async()=>{setCreatingPdf(true);try{const blob=await makePdf();if(!await sharePdf(blob,fileName,`سند قبض رقم ${receipt.number}`,message)){downloadPdf(blob,fileName);toast({title:"تم تنزيل PDF لإرفاقه يدويًا",variant:"success"})}}catch(error){if(error instanceof DOMException&&error.name==="AbortError")return;toast({title:"تعذرت المشاركة",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}finally{setCreatingPdf(false)}}
  const openWithPdf=async(target:"email"|"whatsapp")=>{const popup=target==="whatsapp"?window.open("about:blank","_blank"):null;setCreatingPdf(true);try{downloadPdf(await makePdf(),fileName);if(target==="whatsapp"){if(popup)popup.location.href=whatsappUrl;else window.location.href=whatsappUrl}else window.location.href=emailUrl;toast({title:"تم تجهيز سند القبض",description:"أرفق ملف PDF الذي تم تنزيله بالرسالة.",variant:"success"})}catch(error){popup?.close();toast({title:"تعذر تجهيز الرسالة",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}finally{setCreatingPdf(false)}}
  return <div className="min-h-screen bg-muted/20 p-3 sm:p-6" dir="rtl">
    <div className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-between gap-2 print:hidden"><Link to="/documents" className="text-sm text-muted-foreground">العودة للمستندات</Link><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{window.print()}}><Printer className="size-4"/>طباعة / PDF</Button><Button variant="outline" disabled={creatingPdf} onClick={()=>{void download()}}><Download className="size-4"/>تنزيل PDF</Button><Button variant="outline" disabled={creatingPdf} onClick={()=>{void nativeShare()}}><Share2 className="size-4"/>مشاركة PDF</Button>{emailUrl?<Button variant="outline" disabled={creatingPdf} onClick={()=>{void openWithPdf('email')}}><Mail className="size-4"/>البريد</Button>:null}{whatsappUrl?<Button variant="outline" disabled={creatingPdf} onClick={()=>{void openWithPdf('whatsapp')}}><MessageCircle className="size-4"/>واتساب</Button>:null}</div></div>
    <article ref={printRef} data-print-area className="mx-auto max-w-3xl rounded-xl border bg-white p-6 shadow-sm sm:p-10 print:border-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">سند قبض</h1><p className="mt-1 font-mono text-primary">{receipt.number}</p></div><div className="flex items-start gap-4">{assets.logo?<img src={assets.logo} alt="شعار المنشأة" className="h-[5.5rem] w-[8.8rem] object-contain"/>:null}<div className="text-end text-sm"><p>{formatDate(receipt.receipt_date)}</p><p className="text-muted-foreground">صادر</p></div></div></header>
      <Separator className="my-6"/>
      <section className="grid gap-6 text-sm sm:grid-cols-2"><Party title="من" name={seller.business_name} vat={seller.vat_number} detail={sellerAddress}/><Party title="استلمنا من" name={receipt.payer_name} vat={receipt.payer_vat_number} detail={receipt.payer_phone}/></section>
      <div className="my-8 rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center"><p className="text-sm text-muted-foreground">المبلغ المستلم</p><p className="mt-2 text-3xl font-bold text-primary" dir="ltr">{formatCurrency(Number(receipt.amount))}</p><p className="mt-3 text-sm font-medium">{amountInWords(Number(receipt.amount))}</p></div>
      <div className="grid gap-3 text-sm sm:grid-cols-2"><Info label="طريقة السداد" value={receipt.payment_method_name}/>{receipt.reference_number?<Info label="الرقم المرجعي" value={receipt.reference_number} ltr/>:null}</div>
      {receipt.notes?<div className="mt-6 border-t pt-4"><p className="font-medium">ملاحظات</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{receipt.notes}</p></div>:null}
      {(receipt.show_stamp&&assets.stamp)||(receipt.show_signature&&assets.signature)?<div className="mt-10 flex justify-end gap-8 border-t pt-5">{receipt.show_stamp&&assets.stamp?<img src={assets.stamp} alt="ختم المنشأة" className="h-28 w-44 object-contain"/>:null}{receipt.show_signature&&assets.signature?<img src={assets.signature} alt="توقيع المنشأة" className="h-28 w-44 object-contain"/>:null}</div>:null}
    </article>
  </div>
}

function Party({title,name,vat,detail}:{title:string;name?:string;vat?:string;detail?:string}){return <div><p className="text-xs text-muted-foreground">{title}</p><p className="font-semibold">{name||"—"}</p>{vat?<p>الرقم الضريبي: <span dir="ltr">{vat}</span></p>:null}{detail?<p>{detail}</p>:null}</div>}
function Info({label,value,ltr=false}:{label:string;value:string;ltr?:boolean}){return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium" dir={ltr?"ltr":undefined}>{value}</p></div>}

const ones=["","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة","عشرة","أحد عشر","اثنا عشر","ثلاثة عشر","أربعة عشر","خمسة عشر","ستة عشر","سبعة عشر","ثمانية عشر","تسعة عشر"]
const tens=["","","عشرون","ثلاثون","أربعون","خمسون","ستون","سبعون","ثمانون","تسعون"]
const hundreds=["","مائة","مائتان","ثلاثمائة","أربعمائة","خمسمائة","ستمائة","سبعمائة","ثمانمائة","تسعمائة"]
function underThousand(value:number){const parts:string[]=[];const h=Math.floor(value/100),rest=value%100;if(h)parts.push(hundreds[h]??"");if(rest){if(rest<20)parts.push(ones[rest]??"");else{const unit=rest%10,ten=Math.floor(rest/10);parts.push(unit?`${ones[unit]} و${tens[ten]}`:tens[ten]??"")}}return parts.filter(Boolean).join(" و")}
function integerWords(value:number){if(value===0)return "صفر";const groups=[{size:1_000_000,singular:"مليون",dual:"مليونان",plural:"ملايين"},{size:1_000,singular:"ألف",dual:"ألفان",plural:"آلاف"}];let remaining=value;const parts:string[]=[];for(const group of groups){const count=Math.floor(remaining/group.size);if(count){parts.push(count===1?group.singular:count===2?group.dual:count<=10?`${underThousand(count)} ${group.plural}`:`${underThousand(count)} ${group.singular}`);remaining%=group.size}}if(remaining)parts.push(underThousand(remaining));return parts.join(" و")}
function amountInWords(amount:number){const rounded=Math.round(amount*100),riyals=Math.floor(rounded/100),halalas=rounded%100;return `فقط ${integerWords(riyals)} ريال سعودي${halalas?` و${integerWords(halalas)} هللة`:""} لا غير`}

