import Dexie, { type EntityTable } from "dexie";

// ─── Local Database Schema ────────────────────────────────────────────────────
// All tables follow the same pattern:
//   - id: UUID (primary key)
//   - organization_id: tenant isolation
//   - sync_status: 'pending' | 'synced' | 'conflict'
//   - created_at / updated_at / deleted_at: timestamps (ISO string)
//   - version: optimistic concurrency control

export interface Organization {
  id: string;
  business_name: string;
  vat_number: string;
  commercial_registration?: string;
  phone?: string;
  email?: string;
  city?: string;
  district?: string;
  street?: string;
  postal_code?: string;
  logo_url?: string;
  signature_url?: string;
  stamp_url?: string;
  subscription_status: "active" | "expired" | "grace";
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
  sync_status: "pending" | "synced" | "conflict";
  version: number;
}

export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  vat_number?: string;
  commercial_registration?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  sync_status: "pending" | "synced" | "conflict";
  version: number;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  customer_id?: string;
  contract_number?: string;
  purchase_order?: string;
  reference_number?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  sync_status: "pending" | "synced" | "conflict";
  version: number;
}

export type DocumentType = "tax_invoice" | "simplified_invoice" | "quotation" | "proforma" | "receipt_voucher";
export type DocumentStatus = "draft" | "issued" | "archived" | "cancelled";
export type OperationType = "service" | "project";

export interface DocumentItem {
  id: string;
  description: string;
  unit?: string;
  quantity?: number;
  unit_price: number;
  discount_percent?: number;
  retention_percent?: number;
  subtotal: number;
}

export interface Document {
  id: string;
  organization_id: string;
  type: DocumentType;
  status: DocumentStatus;
  number: string;
  date: string;
  due_date?: string;
  customer_id?: string;
  customer_name: string;
  customer_vat_number?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  operation_type: OperationType;
  project_id?: string;
  project_name?: string;
  contract_number?: string;
  purchase_order?: string;
  items: DocumentItem[];
  subtotal: number;
  discount_amount: number;
  retention_amount: number;
  vat_amount: number;
  total: number;
  vat_rate: number;
  vat_inclusive: boolean;
  payment_method?: string;
  bank_account_id?: string;
  notes?: string;
  terms_and_conditions?: string;
  qr_code?: string;
  issued_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  sync_status: "pending" | "synced" | "conflict";
  version: number;
}

export interface PurchaseInvoice {
  id: string;
  organization_id: string;
  supplier_name: string;
  supplier_vat_number: string;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  qr_raw: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  sync_status: "pending" | "synced" | "conflict";
  version: number;
}

export interface Expense {
  id: string;
  organization_id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  sync_status: "pending" | "synced" | "conflict";
  version: number;
}

export interface Setting {
  id: string;
  organization_id: string;
  key: string;
  value: string;
  updated_at: string;
}

// ─── Dexie Database ───────────────────────────────────────────────────────────

class EasyTaxDatabase extends Dexie {
  organizations!: EntityTable<Organization, "id">;
  customers!: EntityTable<Customer, "id">;
  projects!: EntityTable<Project, "id">;
  documents!: EntityTable<Document, "id">;
  purchase_invoices!: EntityTable<PurchaseInvoice, "id">;
  expenses!: EntityTable<Expense, "id">;
  settings!: EntityTable<Setting, "id">;

  constructor() {
    super("EasyTaxDB");

    this.version(1).stores({
      organizations: "id, sync_status",
      customers: "id, organization_id, name, vat_number, sync_status, deleted_at",
      projects: "id, organization_id, name, customer_id, sync_status, deleted_at",
      documents: "id, organization_id, type, status, number, date, customer_id, project_id, sync_status, deleted_at",
      purchase_invoices: "id, organization_id, invoice_date, supplier_vat_number, sync_status, deleted_at",
      expenses: "id, organization_id, category, date, sync_status, deleted_at",
      settings: "id, organization_id, key",
    });
  }
}

export const db = new EasyTaxDatabase();
