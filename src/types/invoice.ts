// Unified Invoice/Order Types
export type InvoiceStatus = 'draft' | 'confirmed' | 'delivered' | 'paid' | 'cancelled' | 'partial';
export type ViewStatus = InvoiceStatus | 'all' | 'templates';

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  invoice_date: string | null;
  delivery_date: string | null;
  order_date: string | null;
  due_date: string | null;
  customer_id: string;
  status: InvoiceStatus;
  is_no_order: boolean;
  
  subtotal: number;
  tax_total: number;
  shipping_total: number;
  discount_total: number;
  total: number;
  
  amount_paid: number;
  amount_due: number;
  
  memo: string | null;
  customer_po_number: string | null;
  
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string | null;
  
  approved_at: string | null;
  approved_by: string | null;
  
  qbo_id: string | null;
  qbo_sync_status: string | null;
  
  // Joined data
  customer_profile?: {
    name: string;
    email: string | null;
  };
}

export interface InvoiceLineItem {
  id: string;
  organization_id: string;
  invoice_id: string;
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_rate: number;
  tax_amount: number;
  discount_rate: number;
  discount_amount: number;
  position: number;
  created_at: string;
  updated_at: string;
  
  // Joined data
  item_profile?: {
    name: string;
    sku: string | null;
  };
}

export const InvoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  delivered: 'Open Invoice',
  paid: 'Paid',
  cancelled: 'Cancelled',
  partial: 'Partially Paid'
};

export const InvoiceStatusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  partial: 'bg-yellow-100 text-yellow-800'
};

export const InvoiceStatusVariants: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  confirmed: 'default',
  delivered: 'outline',
  paid: 'outline',
  cancelled: 'destructive',
  partial: 'secondary'
};
