export function applyExpensePayment(total: number, paid: number, payment: number) {
  const remaining = total - paid
  if (remaining <= 0) return { ok: false as const, reason: "ALREADY_PAID" as const, remaining: 0 }
  if (payment <= 0 || payment > remaining) return { ok: false as const, reason: "INVALID_AMOUNT" as const, remaining }
  const newPaid = paid + payment
  return { ok: true as const, paid: newPaid, remaining: total - newPaid, status: newPaid >= total ? "paid" as const : "partially_paid" as const }
}

export function reverseRecordedPayment(total: number, paid: number, reversed: number) {
  if (reversed <= 0 || reversed > paid) return { ok: false as const, reason: "INVALID_REVERSAL" as const }
  const newPaid = Math.max(0, Math.round((paid - reversed) * 100) / 100)
  return {
    ok: true as const,
    paid: newPaid,
    remaining: Math.max(0, Math.round((total - newPaid) * 100) / 100),
    status: newPaid <= 0 ? "unpaid" as const : newPaid >= total ? "paid" as const : "partially_paid" as const,
  }
}
