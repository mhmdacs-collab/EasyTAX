/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { useEffect,useMemo,useState } from "react"
import { Link } from "@tanstack/react-router"
import { FileText,Plus,Search } from "lucide-react"
import { listDocuments,listReceipts,type CentralDocument,type CentralReceipt } from "@/lib/platform/api"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { formatCurrency,formatDate } from "@/shared/utils"
import { toast } from "@/shared/hooks/useToast"

type Filter="all"|"invoice"|"quotation"|"receipt"
type ListedItem={id:string;kind:"invoice"|"quotation"|"receipt";number:string;party:string;date:string;amount:number;draft:boolean}

export function DocumentsPage(){
 const[documents,setDocuments]=useState<CentralDocument[]>([]),[receipts,setReceipts]=useState<CentralReceipt[]>([]),[search,setSearch]=useState(""),[loading,setLoading]=useState(true),[filter,setFilter]=useState<Filter>("all")
 useEffect(()=>{void Promise.all([listDocuments(),listReceipts()]).then(([documentResult,receiptResult])=>{setDocuments(documentResult.documents);setReceipts(receiptResult.receipts)}).catch((error:unknown)=>{toast({title:"تعذر تحميل المستندات",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}).finally(()=>{setLoading(false)})},[])
 const items=useMemo<ListedItem[]>(()=>[
  ...documents.map((document)=>({id:document.id,kind:document.type,number:document.number,party:document.customer_snapshot?.name??"—",date:document.issue_date,amount:Number(document.total),draft:document.status==="draft"})),
  ...receipts.map((receipt)=>({id:receipt.id,kind:"receipt" as const,number:receipt.number,party:receipt.payer_name,date:receipt.receipt_date,amount:Number(receipt.amount),draft:false})),
 ].sort((a,b)=>b.date.localeCompare(a.date)),[documents,receipts])
 const shown=useMemo(()=>items.filter((item)=>(filter==="all"||item.kind===filter)&&(!search||item.number.toLocaleLowerCase("ar").includes(search.toLocaleLowerCase("ar"))||item.party.toLocaleLowerCase("ar").includes(search.toLocaleLowerCase("ar")))),[items,filter,search])
 return <div className="space-y-5 p-4 sm:p-6" dir="rtl"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">المستندات</h1><p className="text-sm text-muted-foreground">{items.length} مستند محفوظ مركزيًا</p></div><div className="flex flex-wrap gap-2"><Link to="/receipts/new"><Button variant="outline" className="gap-2"><Plus className="size-4"/>سند قبض جديد</Button></Link><Link to="/documents/new" search={{type:"quotation"}}><Button variant="outline" className="gap-2"><Plus className="size-4"/>عرض سعر جديد</Button></Link><Link to="/documents/new"><Button className="gap-2"><Plus className="size-4"/>فاتورة جديدة</Button></Link></div></div>
 <div className="flex flex-wrap gap-2">{([['all','الكل'],['invoice','الفواتير'],['quotation','عروض الأسعار'],['receipt','سندات القبض']] as const).map(([value,label])=><Button key={value} type="button" size="sm" variant={filter===value?"default":"outline"} onClick={()=>{setFilter(value)}}>{label}</Button>)}</div>
 <div className="relative max-w-md"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="ps-9" placeholder="ابحث بالرقم أو اسم العميل" value={search} onChange={(event)=>{setSearch(event.target.value)}}/></div>
 {loading?<p className="py-20 text-center text-muted-foreground">جاري التحميل...</p>:shown.length?<div className="overflow-hidden rounded-xl border bg-card"><div className="hidden grid-cols-[.8fr_1fr_1.5fr_1fr_1fr] gap-3 border-b bg-muted/40 px-4 py-3 text-sm font-medium sm:grid"><span>النوع</span><span>الرقم</span><span>العميل / الدافع</span><span>التاريخ</span><span>الإجمالي</span></div>{shown.map((item)=>item.kind==="receipt"?<Link key={`receipt-${item.id}`} to="/receipts/$id" params={{id:item.id}} className="grid gap-1 border-b p-4 last:border-0 hover:bg-muted/30 sm:grid-cols-[.8fr_1fr_1.5fr_1fr_1fr] sm:gap-3"><Item item={item}/></Link>:<Link key={`document-${item.id}`} to="/documents/$id" params={{id:item.id}} className="grid gap-1 border-b p-4 last:border-0 hover:bg-muted/30 sm:grid-cols-[.8fr_1fr_1.5fr_1fr_1fr] sm:gap-3"><Item item={item}/></Link>)}</div>:<div className="py-24 text-center text-muted-foreground"><FileText className="mx-auto mb-3 size-14 opacity-20"/><p>لا توجد مستندات مطابقة</p></div>}</div>
}

function Item({item}:{item:ListedItem}){return <><span>{item.kind==="quotation"?"عرض سعر":item.kind==="receipt"?"سند قبض":"فاتورة"}</span><span className="font-mono font-medium">{item.draft?"مسودة":item.number}</span><span>{item.party}</span><span className="text-muted-foreground">{formatDate(item.date)}</span><span>{formatCurrency(item.amount)}</span></>}
