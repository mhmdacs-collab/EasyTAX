export function applyExpensePayment(total: number, paid: number, payment: number) {
  const remaining = total - paid
  if (remaining <= 0) return { ok: false as const, reason: "ALREADY_PAID" as const, remaining: 0 }
  if (payment <= 0 || payment > remaining) return { ok: false as const, reason: "INVALID_AMOUNT" as const, remaining }
  const newPaid = paid + payment
  return { ok: true as const, paid: newPaid, remaining: total - newPaid, status: newPaid >= total ? "paid" as const : "partially_paid" as const }
}
