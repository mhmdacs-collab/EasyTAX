// ─── Core Domain Types ────────────────────────────────────────────────────────

export type ID = string; // UUID

export type SyncStatus = "pending" | "synced" | "conflict";

export type DocumentType =
  | "tax_invoice"
  | "simplified_invoice"
  | "quotation"
  | "proforma"
  | "receipt_voucher";

export type DocumentStatus = "draft" | "issued" | "paid" | "partially_paid" | "archived" | "cancelled";

export type OperationType = "service" | "project";

export type SubscriptionStatus = "active" | "expired" | "grace";

// ─── Organization ─────────────────────────────────────────────────────────────

export interface Organization {
  id: ID;
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
  subscription_status: SubscriptionStatus;
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: ID;
  organization_id: ID;
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
}

// ─── Project (business project) ───────────────────────────────────────────────

export interface Project {
  id: ID;
  organization_id: ID;
  name: string;
  customer_id?: ID;
  contract_number?: string;
  purchase_order?: string;
  reference_number?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ─── Document ─────────────────────────────────────────────────────────────────

export interface DocumentItem {
  id: ID;
  description: string;
  unit?: string;
  quantity?: number;
  unit_price: number;
  discount_percent?: number;
  retention_percent?: number;
  subtotal: number;
}

export interface Document {
  id: ID;
  organization_id: ID;
  type: DocumentType;
  status: DocumentStatus;
  number: string;
  date: string;
  due_date?: string;
  customer_id?: ID;
  customer_name: string;
  customer_vat_number?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  operation_type: OperationType;
  project_id?: ID;
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
  bank_account_id?: ID;
  notes?: string;
  terms_and_conditions?: string;
  qr_code?: string;
  issued_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ─── Purchase Invoice ─────────────────────────────────────────────────────────

export interface PurchaseInvoice {
  id: ID;
  organization_id: ID;
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
}

// ─── Expense ──────────────────────────────────────────────────────────────────

export interface Expense {
  id: ID;
  organization_id: ID;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
