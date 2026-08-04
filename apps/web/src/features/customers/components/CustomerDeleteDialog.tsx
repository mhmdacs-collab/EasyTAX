import { useState } from "react"
import { deleteCustomer, type CentralCustomer } from "@/lib/platform/api"
import { toast } from "@/shared/hooks/useToast"
import { Dialog,DialogContent,DialogFooter,DialogHeader,DialogTitle } from "@/shared/components/ui/dialog"
import { Button } from "@/shared/components/ui/button"
export function CustomerDeleteDialog({customer,onClose,onDeleted}:{customer:CentralCustomer|null;onClose:()=>void;onDeleted:(id:string)=>void}){
 const[loading,setLoading]=useState(false);const confirm=async()=>{if(!customer)return;setLoading(true);try{await deleteCustomer(customer.id);onDeleted(customer.id);onClose();toast({title:"تم حذف العميل"})}catch(e){toast({title:"تعذر الحذف",description:e instanceof Error?e.message:"حاول مرة أخرى",variant:"error"})}finally{setLoading(false)}}
 return <Dialog open={!!customer} onOpenChange={(v)=>{if(!v)onClose()}}><DialogContent className="sm:max-w-sm" dir="rtl"><DialogHeader><DialogTitle>حذف العميل</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">هل تريد حذف <b className="text-foreground">{customer?.name}</b>؟ لن تتغير المستندات الصادرة سابقًا.</p><DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>إلغاء</Button><Button variant="destructive" loading={loading} onClick={()=>void confirm()}>حذف</Button></DialogFooter></DialogContent></Dialog>
}
