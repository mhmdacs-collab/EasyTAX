import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { postJournalEntry } from "./accountingEngine"
import { receiptJournal } from "./accountingRules"

export type IssueReceiptInput = {
  organizationId:string
  customerId?:string|null
  payerName:string
  payerPhone?:string|null
  payerEmail?:string|null
  payerVatNumber?:string|null
  receiptDate:string
  amount:number
  paymentMethodName:string
  referenceNumber?:string|null
  notes?:string|null
  organizationSnapshot:Record<string,unknown>
  showStamp:boolean
  showSignature:boolean
  sourceDocumentId?:string|null
  sourcePaymentId?:string|null
  requestId?:string|null
}

export async function issueReceipt(client:PoolClient,input:IssueReceiptInput){
  if(input.requestId){
    const existing=await client.query("SELECT * FROM customer_receipts WHERE organization_id=$1 AND request_id=$2 LIMIT 1",[input.organizationId,input.requestId])
    if(existing.rows[0])return existing.rows[0] as Record<string,unknown>
  }
  if(input.sourcePaymentId){
    const existing=await client.query("SELECT * FROM customer_receipts WHERE organization_id=$1 AND source_payment_id=$2 LIMIT 1",[input.organizationId,input.sourcePaymentId])
    if(existing.rows[0])return existing.rows[0] as Record<string,unknown>
  }
  await client.query("INSERT INTO document_sequences(organization_id,document_type,next_number) VALUES($1,'receipt',1) ON CONFLICT(organization_id,document_type) DO NOTHING",[input.organizationId])
  const sequence=await client.query(`SELECT GREATEST(ds.next_number,COALESCE((SELECT MAX(number::bigint)+1 FROM customer_receipts WHERE organization_id=$1 AND number ~ '^\\d+$'),1)) AS candidate FROM document_sequences ds WHERE ds.organization_id=$1 AND ds.document_type='receipt' FOR UPDATE`,[input.organizationId])
  if(input.requestId){
    const existing=await client.query("SELECT * FROM customer_receipts WHERE organization_id=$1 AND request_id=$2 LIMIT 1",[input.organizationId,input.requestId])
    if(existing.rows[0])return existing.rows[0] as Record<string,unknown>
  }
  if(input.sourcePaymentId){
    const existing=await client.query("SELECT * FROM customer_receipts WHERE organization_id=$1 AND source_payment_id=$2 LIMIT 1",[input.organizationId,input.sourcePaymentId])
    if(existing.rows[0])return existing.rows[0] as Record<string,unknown>
  }
  const candidate=Number(sequence.rows[0].candidate),number=String(candidate).padStart(5,"0")
  await client.query("UPDATE document_sequences SET next_number=$1 WHERE organization_id=$2 AND document_type='receipt'",[candidate+1,input.organizationId])
  const receipt=await client.query(`INSERT INTO customer_receipts(id,organization_id,customer_id,number,receipt_date,amount,payment_method_name,payer_name,payer_phone,payer_email,payer_vat_number,reference_number,notes,organization_snapshot,show_stamp,show_signature,source_document_id,source_payment_id,request_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,[randomUUID(),input.organizationId,input.customerId||null,number,input.receiptDate,input.amount,input.paymentMethodName,input.payerName,input.payerPhone||null,input.payerEmail||null,input.payerVatNumber||null,input.referenceNumber||null,input.notes||null,JSON.stringify(input.organizationSnapshot),input.showStamp,input.showSignature,input.sourceDocumentId||null,input.sourcePaymentId||null,input.requestId||null])
  const row=receipt.rows[0] as Record<string,unknown>
  await postJournalEntry(client,{organizationId:input.organizationId,entryDate:input.receiptDate,sourceType:"receipt",sourceId:String(row.id),idempotencyKey:`receipt:${String(row.id)}:issued`,description:`سند قبض رقم ${number}`,customerId:input.customerId??null,lines:receiptJournal({amount:input.amount,linkedToInvoice:Boolean(input.sourceDocumentId)})})
  await client.query("INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,snapshot) VALUES($1,'receipt',$2,'issued',$3)",[input.organizationId,row.id,JSON.stringify(row)])
  return row
}
