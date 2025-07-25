-- Fix the remaining RLS disabled tables
-- Enable RLS on any tables that don't have it enabled

-- Check and enable RLS on tables that might be missing it
ALTER TABLE public.bill_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.invoice_record ENABLE ROW LEVEL SECURITY;