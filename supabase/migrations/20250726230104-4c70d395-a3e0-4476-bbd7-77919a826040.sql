-- Add 'template_generated' to the allowed sales_order status values
ALTER TABLE sales_order 
DROP CONSTRAINT sales_order_status_check;

ALTER TABLE sales_order 
ADD CONSTRAINT sales_order_status_check 
CHECK (status::text = ANY (ARRAY[
  'draft'::text, 
  'open'::text, 
  'pending_approval'::text, 
  'approved'::text, 
  'in_process'::text, 
  'on_hold'::text, 
  'shipped'::text, 
  'partial_shipped'::text, 
  'invoiced'::text, 
  'partial_invoiced'::text, 
  'closed'::text, 
  'canceled'::text,
  'template_generated'::text
]));