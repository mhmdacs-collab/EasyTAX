# EasyTAX Engineering Principles

These principles are mandatory.
Every implementation must follow them.
If a requested implementation conflicts with these principles, stop and explain the conflict before writing code.

---

## 1. Product Identity

EasyTAX is an invoicing and business documents platform.

It is NOT an ERP.

Do not introduce ERP concepts unless explicitly requested.

---

## 2. Simplicity First

Every feature must reduce user effort.

If there are multiple valid implementations, always choose the simplest one.

Never increase complexity without a measurable business benefit.

---

## 3. Documents Are The Core

Invoices, quotations, purchase invoices, receipts and similar documents are the heart of the system.

Everything should revolve around documents.

Avoid creating independent business modules when extending the existing document engine is sufficient.

---

## 4. Offline First

The application must always remain usable without an internet connection.

Synchronization is secondary.

Local operation is primary.

---

## 5. Saudi First

Business rules must prioritize Saudi regulations.

ZATCA compliance has higher priority than generic international behavior.

---

## 6. Business Before Technology

Business requirements always take precedence over technical implementation.

Never solve a technical issue before validating the intended business behavior.

---

## 7. Keep Modules Small

Each screen should have one clear responsibility.

Each component should solve one problem.

Avoid large, multi-purpose components.

---

## 8. Minimize Dependencies

Do not introduce new libraries or frameworks unless they provide significant long-term value.

Prefer existing project infrastructure.

---

## 9. Reuse Before Creating

Before creating a new component, service or utility:

- Search the existing project.
- Reuse existing code whenever appropriate.
- Avoid duplicate implementations.

---

## 10. Predictable Architecture

Follow existing architecture and coding patterns.

Do not introduce new architectural styles inside the same project.

Consistency is more valuable than personal preference.

---

## 11. Safe Changes

Every implementation must preserve existing functionality.

Avoid regressions.

Do not modify unrelated files.

Keep the implementation scope as small as possible.

---

## 12. Definition of Success

A task is NOT complete because it builds successfully.

A task is complete only when:

- Build succeeds.
- Runtime succeeds.
- No browser console errors exist.
- No runtime exceptions occur.
- No IndexedDB errors occur.
- No regressions are introduced.
- The requested workflow works from the user's perspective.

---

## 13. Configuration Over Customization

Business behavior should be configurable through Settings.

Avoid creating separate implementations when configuration can solve the same problem.

Temporary changes requested by a user (for example, changing quotation validity from 15 days to 7 days) should affect only the current document unless explicitly saved in Settings.

Refer to `.ai/DEFINITION_OF_DONE.md` for the complete checklist.
