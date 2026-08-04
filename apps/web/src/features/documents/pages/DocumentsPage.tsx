/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { useEffect,useMemo,useState } from "react"
import { Link } from "@tanstack/react-router"
import { FileText,Plus,Search } from "lucide-react"
import { listDocuments,type CentralDocument } from "@/lib/platform/api"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { formatCurrency,formatDate } from "@/shared/utils"
import { toast } from "@/shared/hooks/useToast"
export function DocumentsPage(){const[documents,setDocuments]=useState<CentralDocument[]>([]),[search,setSearch]=useState(""),[loading,setLoading]=useState(true)
 useEffect(()=>{void listDocuments().then((result)=>{setDocuments(result.documents)}).catch((error:unknown)=>{toast({title:"تعذر تحميل المستندات",description:error instanceof Error?error.message:"حاول مرة أخرى",variant:"error"})}).finally(()=>{setLoading(false)})},[])
 const shown=useMemo(()=>documents.filter((document)=>!search||document.number.includes(search)||document.customer_snapshot?.name?.includes(search)),[documents,search])
 return <div className="space-y-5 p-4 sm:p-6" dir="rtl"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">الفواتير الضريبية</h1><p className="text-sm text-muted-foreground">{documents.length} مستند محفوظ مركزيًا</p></div><Link to="/documents/new"><Button className="gap-2"><Plus className="size-4"/>فاتورة جديدة</Button></Link></div><div className="relative max-w-md"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="ps-9" placeholder="ابحث بالرقم أو العميل" value={search} onChange={(event)=>{setSearch(event.target.value)}}/></div>
 {loading?<p className="py-20 text-center text-muted-foreground">جاري التحميل...</p>:shown.length?<div className="overflow-hidden rounded-xl border bg-card"><div className="hidden grid-cols-[1fr_1.5fr_1fr_1fr] gap-3 border-b bg-muted/40 px-4 py-3 text-sm font-medium sm:grid"><span>الرقم</span><span>العميل</span><span>التاريخ</span><span>الإجمالي</span></div>{shown.map((document)=><Link key={document.id} to="/documents/$id" params={{id:document.id}} className="grid gap-1 border-b p-4 last:border-0 hover:bg-muted/30 sm:grid-cols-[1fr_1.5fr_1fr_1fr] sm:gap-3"><span className="font-mono font-medium">{document.status==="draft"?"مسودة":document.number}</span><span>{document.customer_snapshot?.name??"—"}</span><span className="text-muted-foreground">{formatDate(document.issue_date)}</span><span>{formatCurrency(Number(document.total))}</span></Link>)}</div>:<div className="py-24 text-center text-muted-foreground"><FileText className="mx-auto mb-3 size-14 opacity-20"/><p>لا توجد فواتير بعد</p></div>}</div>}
