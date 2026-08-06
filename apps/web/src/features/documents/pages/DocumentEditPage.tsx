import { useEffect,useState } from "react"
import { useParams } from "@tanstack/react-router"
import { fetchDocument,type CentralDocument } from "@/lib/platform/api"
import type { Document } from "@/lib/db"
import { DocumentForm } from "../components/DocumentForm"
export function DocumentEditPage(){const{id}=useParams({from:"/app/documents/$id/edit"});const[document,setDocument]=useState<CentralDocument>()
 useEffect(()=>{void fetchDocument(id).then((result)=>{setDocument(result.document)})},[id]);if(!document)return <p className="p-6 text-muted-foreground">جاري تحميل المسودة...</p>;if(document.status!=="draft")return <p className="p-6 text-muted-foreground">يمكن تعديل المسودات فقط.</p>
 const customer=document.customer_snapshot
 const draft:Document={id:document.id,organization_id:"",type:"tax_invoice",status:"draft",number:document.number,date:document.issue_date,due_date:document.due_date,customer_id:customer.id,customer_name:customer.name,customer_vat_number:customer.vat_number,customer_phone:customer.phone,customer_email:customer.email,customer_address:[customer.street,customer.building_number,customer.district,customer.city,customer.postal_code].filter(Boolean).join("، "),operation_type:"service",items:(document.items??[]).map((item)=>({id:item.id,description:item.description,quantity:Number(item.quantity),unit_price:Number(item.unit_price),discount_percent:0,retention_percent:Number(item.retention_rate),subtotal:Number(item.line_subtotal)})),subtotal:Number(document.subtotal),discount_amount:0,retention_amount:Number(document.retention_total),vat_amount:Number(document.tax_total),total:Number(document.total),vat_rate:15,vat_inclusive:document.prices_include_tax,notes:document.notes,payment_method:document.reference_data.payment_method,created_at:document.created_at,updated_at:document.updated_at,sync_status:"synced",version:1}
 return <DocumentForm draft={draft} initialAppearance={{show_stamp:document.show_stamp,show_signature:document.show_signature}} initialPayments={(document.payments??[]).map((payment)=>({payment_method_name:payment.payment_method_name,amount:Number(payment.amount)}))}/>
}
