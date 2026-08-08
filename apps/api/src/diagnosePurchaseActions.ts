import { Pool } from "pg"
import { postJournalEntry, reverseSourceJournalEntries } from "./lib/accountingEngine"
import { purchaseTaxExclusionJournal } from "./lib/accountingRules"

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
const client = await pool.connect()

try {
  await client.query("BEGIN")
  const purchaseResult = await client.query(`SELECT * FROM purchase_invoices
    WHERE status='included' AND tax_total>0 AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE`)
  const purchase = purchaseResult.rows[0]
  if (purchase) {
    await postJournalEntry(client, {
      organizationId: String(purchase.organization_id),
      entryDate: String(purchase.invoice_date).slice(0, 10),
      sourceType: "purchase_tax_adjustment",
      sourceId: String(purchase.id),
      idempotencyKey: `diagnostic:purchase-exclusion:${crypto.randomUUID()}`,
      description: "diagnostic purchase exclusion",
      supplierReference: String(purchase.supplier_vat_number ?? ""),
      lines: purchaseTaxExclusionJournal(Number(purchase.tax_total)),
    })
    const updated = await client.query(`UPDATE purchase_invoices SET status='excluded',include_in_tax_return=FALSE,
      exclusion_reason='diagnostic rollback',updated_at=NOW() WHERE id=$1 RETURNING *`, [purchase.id])
    await client.query(`INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot)
      VALUES($1,'purchase_invoice',$2,'excluded','diagnostic rollback',$3)`, [purchase.organization_id, purchase.id, JSON.stringify(updated.rows[0])])
    console.log(`TypeScript exclusion simulation succeeded for ${String(purchase.internal_number)}`)
  }
  await client.query("ROLLBACK")

  await client.query("BEGIN")
  const paymentResult = await client.query(`SELECT pp.* FROM purchase_invoice_payments pp
    WHERE pp.status='issued' AND EXISTS (
      SELECT 1 FROM journal_entries je WHERE je.organization_id=pp.organization_id AND je.source_type='purchase_payment'
        AND je.source_id=pp.id AND je.status='posted' AND je.reversal_of_entry_id IS NULL
    ) ORDER BY pp.created_at DESC LIMIT 1 FOR UPDATE`)
  const payment = paymentResult.rows[0]
  if (payment) {
    await reverseSourceJournalEntries(client, {
      organizationId: String(payment.organization_id),
      sourceType: "purchase_payment",
      sourceId: String(payment.id),
      reversalDate: String(payment.payment_date).slice(0, 10),
      reason: "diagnostic rollback",
    })
    const cancelled = await client.query(`UPDATE purchase_invoice_payments SET status='cancelled',cancelled_at=NOW(),
      cancellation_reason='diagnostic rollback',updated_at=NOW() WHERE id=$1 RETURNING *`, [payment.id])
    await client.query(`INSERT INTO financial_audit_events(organization_id,entity_type,entity_id,action,reason,snapshot)
      VALUES($1,'purchase_payment',$2,'payment_cancelled','diagnostic rollback',$3)`, [payment.organization_id, payment.id, JSON.stringify(cancelled.rows[0])])
    console.log(`TypeScript payment reversal simulation succeeded for ${String(payment.id)}`)
  }
  await client.query("ROLLBACK")
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  client.release()
  await pool.end()
}
