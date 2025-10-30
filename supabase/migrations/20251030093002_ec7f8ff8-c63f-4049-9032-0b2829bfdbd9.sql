-- Create sales_order table
CREATE TABLE IF NOT EXISTS public.sales_order (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customer_profile(id) ON DELETE CASCADE,
  order_number VARCHAR(50) NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'cancelled')),
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_total NUMERIC(10,2) DEFAULT 0,
  shipping_total NUMERIC(10,2) DEFAULT 0,
  discount_total NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  memo TEXT,
  is_no_order_today BOOLEAN DEFAULT false,
  invoiced BOOLEAN DEFAULT false,
  invoice_id UUID,
  created_from_template BOOLEAN DEFAULT false,
  template_id UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, order_number)
);

-- Create sales_order_line_item table
CREATE TABLE IF NOT EXISTS public.sales_order_line_item (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sales_order_id UUID NOT NULL REFERENCES public.sales_order(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.item_record(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  discount_rate NUMERIC(10,2) DEFAULT 0,
  tax_rate NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) GENERATED ALWAYS AS (((quantity * unit_price) * tax_rate) / 100) STORED,
  quantity_fulfilled NUMERIC(10,2) DEFAULT 0,
  quantity_invoiced NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales_order_invoice_link table
CREATE TABLE IF NOT EXISTS public.sales_order_invoice_link (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sales_order_id UUID NOT NULL REFERENCES public.sales_order(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoice_record(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sales_order_id, invoice_id)
);

-- Enable RLS on all tables
ALTER TABLE public.sales_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_line_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_invoice_link ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_order
CREATE POLICY "Users can view their organization's sales orders"
  ON public.sales_order FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create sales orders for their organization"
  ON public.sales_order FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their organization's sales orders"
  ON public.sales_order FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their organization's sales orders"
  ON public.sales_order FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- RLS Policies for sales_order_line_item
CREATE POLICY "Users can view their organization's line items"
  ON public.sales_order_line_item FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create line items for their organization"
  ON public.sales_order_line_item FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their organization's line items"
  ON public.sales_order_line_item FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their organization's line items"
  ON public.sales_order_line_item FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- RLS Policies for sales_order_invoice_link
CREATE POLICY "Users can view their organization's invoice links"
  ON public.sales_order_invoice_link FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create invoice links for their organization"
  ON public.sales_order_invoice_link FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete invoice links for their organization"
  ON public.sales_order_invoice_link FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Indexes
CREATE INDEX idx_sales_order_delivery_date ON public.sales_order(delivery_date, status);
CREATE INDEX idx_sales_order_org_delivery ON public.sales_order(organization_id, delivery_date);
CREATE INDEX idx_sales_order_customer ON public.sales_order(customer_id);
CREATE INDEX idx_sales_order_line_item_order ON public.sales_order_line_item(sales_order_id);
CREATE INDEX idx_sales_order_invoice_link_order ON public.sales_order_invoice_link(sales_order_id);
CREATE INDEX idx_sales_order_invoice_link_invoice ON public.sales_order_invoice_link(invoice_id);

-- Triggers for updated_at
CREATE TRIGGER update_sales_order_updated_at
  BEFORE UPDATE ON public.sales_order
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_order_line_item_updated_at
  BEFORE UPDATE ON public.sales_order_line_item
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_order_invoice_link_updated_at
  BEFORE UPDATE ON public.sales_order_invoice_link
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update sales order totals when line items change
CREATE TRIGGER trigger_update_sales_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_order_line_item
  FOR EACH ROW EXECUTE FUNCTION public.update_sales_order_totals();