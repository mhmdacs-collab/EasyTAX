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

--------

# Decision-002

Title:
Single Source of Truth for Tool Versions

Status:
Approved

Decision:

Tool versions must be declared in one place only.

For pnpm, the authoritative version is:

package.json -> packageManager

GitHub Actions must consume that version instead of redefining it.

Reason:

Avoid CI failures caused by version drift.
