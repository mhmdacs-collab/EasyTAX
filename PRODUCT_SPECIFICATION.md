# PRODUCT_SPECIFICATION.md

# Purpose

Define the complete functional specification of EasyTAX.

This document is the single source of truth for product behavior.

This document describes WHAT the product must do.

It never describes HOW it should be implemented.

---

# Product Identity

Product Name:
EasyTAX

Product Type:
Local-First SaaS Progressive Web Application (PWA)

Primary Market:
Saudi Arabia

Target Users:
Small and Medium Businesses (SMBs)

Primary Users:
Business Owners

Primary Purpose:
Issue professional business documents and simplify Saudi tax compliance.

Success Criteria:
Complete any common business document in less than one minute.

---

# Product Goals

- Simplify business document creation.
- Simplify Saudi tax compliance.
- Minimize manual data entry.
- Operate without internet connectivity.
- Hide accounting complexity from business owners.
- Maintain a fast and intuitive user experience.
- Keep the Core application lightweight.
- Support future expansion through Plugins.

---

# Core Principles

- Local First
- Simplicity First
- Plugin First
- Auto Save
- Search Before Create
- One Minute Rule
- AI Friendly
- No ERP Complexity

---

# Core Modules

- Organization
- Customers
- Projects
- Business Documents
- Purchase Invoices
- Expenses
- Dashboard
- Reports
- VAT Return
- Financial Statements
- Notifications
- Archive
- Settings
- Subscription
- Plugins

---

# Business Documents

- Tax Invoice
- Simplified Tax Invoice
- Quotation
- Proforma Invoice
- Receipt Voucher

---

# Business Workflow

Customer
→ Business Document
→ Archive
→ Reports
→ VAT Return
→ Financial Statements

Purchase QR
→ Purchase Invoice
→ Purchases
→ VAT Return
→ Financial Statements

Expense
→ Expense Category
→ Reports
→ Financial Statements

---

# Business Rules

- Invoice numbers are sequential.
- Documents become read-only after issuance.
- Documents may be archived but never modified.
- Purchase invoices require a valid Saudi QR Code.
- QR validation determines tax eligibility.
- Expenses are manually recorded.
- Projects are optional.
- Units are optional.
- Quantity is optional.
- Services may contain description and price only.
- Customers are created automatically if they do not exist.
- Search before creating any master data.
- VAT calculations follow organization settings.
- Generated documents support PDF, Print, Email and WhatsApp sharing.

---

# Product Constraints

The Core application must never include:

- ERP
- Inventory Management
- Warehouse Management
- Payroll
- Manufacturing
- Human Resources
- General Ledger
- Journal Entries
- Fixed Assets
- Cost Centers
- CRM

These capabilities may be implemented as Plugins.

---

# Future Expansion

- AI Assistant
- OCR
- Cloud Document Storage
- Saudi Government APIs
- Plugin Marketplace
- Third-party Integrations

---

# Acceptance Criteria

- Business documents can be issued in less than one minute.
- Application operates fully offline.
- Background synchronization is transparent.
- Generated tax invoices comply with Saudi regulations.
- Purchase invoices support Saudi QR validation.
- VAT Return is generated from Sales and Purchases.
- Financial Statements are generated from Sales, Purchases and Expenses.
- Core remains independent from optional Plugins.

---
END
