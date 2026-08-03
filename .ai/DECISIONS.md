# Decision-001

Title:
Document Sorting Strategy

Status:
Approved

Date:
2026-08-03

Decision:

Two different date fields have different business meanings.

date

- Business document date.
- Selected by the user.
- Used for accounting and document chronology.

created_at

- System creation timestamp.
- Automatically generated.
- Represents user activity.

Rules:

Dashboard

Sort by:

created_at DESC

Reason:

Dashboard represents recent activity.

Documents List

Sort by:

date DESC

Reason:

Documents page represents business chronology.

Never treat these fields as interchangeable.
