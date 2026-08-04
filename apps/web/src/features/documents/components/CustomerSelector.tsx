import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { listCustomers, type CentralCustomer } from "@/lib/platform/api"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"

interface CustomerFields { customer_id:string; customer_name:string; customer_vat_number:string; customer_phone:string; customer_email:string; customer_address:string }
export function CustomerSelector({values,onChange}:{values:CustomerFields;onChange:(fields:Partial<CustomerFields>)=>void}){
 const[customers,setCustomers]=useState<CentralCustomer[]>([]);const[search,setSearch]=useState("");const[open,setOpen]=useState(false)
 useEffect(()=>{void listCustomers().then((result)=>{setCustomers(result.customers)})},[])
 const filtered=useMemo(()=>customers.filter((customer)=>!search||customer.name.includes(search)||customer.vat_number.includes(search)),[customers,search])
 const select=(customer:CentralCustomer)=>{onChange({customer_id:customer.id,customer_name:customer.name,customer_vat_number:customer.vat_number,customer_phone:customer.phone??"",customer_email:customer.email??"",customer_address:[customer.street,customer.building_number,customer.district,customer.city,customer.postal_code].filter(Boolean).join("، ")});setSearch("");setOpen(false)}
 return <div className="space-y-3"><div className="space-y-1.5"><Label>العميل *</Label><div className="relative"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="ps-9" placeholder="ابحث عن عميل محفوظ" value={open?search:values.customer_name} onFocus={()=>{setOpen(true);setSearch("")}} onChange={(event)=>{setSearch(event.target.value);setOpen(true)}}/>{open?<div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-popover shadow-lg">{filtered.length?filtered.map((customer)=><button type="button" key={customer.id} className="block w-full border-b px-3 py-2 text-start last:border-0 hover:bg-accent" onMouseDown={()=>{select(customer)}}><span className="block text-sm font-medium">{customer.name}</span><span className="text-xs text-muted-foreground" dir="ltr">{customer.vat_number}</span></button>):<p className="p-3 text-sm text-muted-foreground">لا يوجد عميل مطابق. أضفه أولًا من صفحة العملاء.</p>}</div>:null}</div></div>
 {values.customer_id?<div className="rounded-lg bg-muted/40 p-3 text-sm"><p className="font-medium">{values.customer_name}</p><p className="text-muted-foreground" dir="ltr">{values.customer_vat_number}</p><p className="text-muted-foreground">{values.customer_address}</p></div>:null}</div>
}
