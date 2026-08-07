import assert from "node:assert/strict"
import test from "node:test"
import { documentJournal, expenseJournal, financialMovementJournal, purchaseJournal, purchaseTaxExclusionJournal, receiptJournal, vatSettlementJournal, yearEndAdjustmentJournal } from "./accountingRules"

const totals=(lines:{debit:number;credit:number}[])=>({debit:lines.reduce((s,l)=>s+l.debit,0),credit:lines.reduce((s,l)=>s+l.credit,0)})
const balanced=(lines:{debit:number;credit:number}[])=>assert.deepEqual(totals(lines),{debit:totals(lines).credit,credit:totals(lines).credit})

test("invoice separates receivable, retention, revenue and VAT",()=>{
  const lines=documentJournal({type:"invoice",total:20700,taxTotal:2700,retentionTotal:1362.16})
  balanced(lines)
  assert.equal(lines.find(l=>l.accountKey==="accounts_receivable")?.debit,19337.84)
  assert.equal(lines.find(l=>l.accountKey==="retention_receivable")?.debit,1362.16)
})

test("credit note reverses revenue and output VAT",()=>{
  const lines=documentJournal({type:"credit_note",total:1150,taxTotal:150})
  balanced(lines)
  assert.equal(lines.find(l=>l.accountKey==="accounts_receivable")?.credit,1150)
})

test("purchase and expense rules are balanced",()=>{
  balanced(purchaseJournal({subtotal:2000,taxTotal:300,total:2300}))
  balanced(purchaseTaxExclusionJournal(300))
  balanced(expenseJournal({amount:5000,financialClass:"fixed_asset"}))
})

test("receipts distinguish invoice settlement from customer advance",()=>{
  assert.equal(receiptJournal({amount:500,linkedToInvoice:true}).find(line=>line.credit>0)?.accountKey,"accounts_receivable")
  assert.equal(receiptJournal({amount:500,linkedToInvoice:false}).find(line=>line.credit>0)?.accountKey,"customer_advances")
})

test("owner and loan movements are balanced",()=>{
  balanced(financialMovementJournal({movementType:"owner_withdrawal",amount:100}))
  balanced(financialMovementJournal({movementType:"loan_received",amount:1000,loanTerm:"non_current"}))
})

test("VAT settlement records payable and refundable balances",()=>{
  const payable=vatSettlementJournal({outputTax:500,inputTax:300})
  balanced(payable)
  assert.equal(payable.find(l=>l.accountKey==="vat_settlement_payable")?.credit,200)
  const refund=vatSettlementJournal({outputTax:100,inputTax:300})
  balanced(refund)
  assert.equal(refund.find(l=>l.accountKey==="vat_refund_receivable")?.debit,200)
})

test("year-end reclassification, depreciation and tax adjustments stay balanced",()=>{
  const lines=yearEndAdjustmentJournal({purchaseFixedAssets:10000,purchasePrepayments:2000,depreciation:1500,zakatExpense:500,incomeTaxExpense:0})
  balanced(lines)
  assert.equal(lines.find(line=>line.accountKey==="fixed_assets")?.debit,10000)
  assert.equal(lines.find(line=>line.accountKey==="accumulated_depreciation")?.credit,1500)
  assert.deepEqual(yearEndAdjustmentJournal({purchaseFixedAssets:0,purchasePrepayments:0,depreciation:0,zakatExpense:0,incomeTaxExpense:0}),[])
})
