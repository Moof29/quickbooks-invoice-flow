-- Create customer_templates table
CREATE TABLE public.customer_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_template_items table
CREATE TABLE public.customer_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  template_id UUID NOT NULL,
  item_id UUID NOT NULL,
  unit_measure VARCHAR NOT NULL DEFAULT 'EA',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  monday_qty NUMERIC NOT NULL DEFAULT 0,
  tuesday_qty NUMERIC NOT NULL DEFAULT 0,
  wednesday_qty NUMERIC NOT NULL DEFAULT 0,
  thursday_qty NUMERIC NOT NULL DEFAULT 0,
  friday_qty NUMERIC NOT NULL DEFAULT 0,
  saturday_qty NUMERIC NOT NULL DEFAULT 0,
  sunday_qty NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Set up RLS for customer_templates
SELECT public.setup_table_rls('customer_templates');

-- Set up RLS for customer_template_items
SELECT public.setup_table_rls('customer_template_items');

-- Add updated_at triggers
CREATE TRIGGER update_customer_templates_updated_at
  BEFORE UPDATE ON public.customer_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_template_items_updated_at
  BEFORE UPDATE ON public.customer_template_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_customer_templates_organization_id ON public.customer_templates(organization_id);
CREATE INDEX idx_customer_templates_customer_id ON public.customer_templates(customer_id);
CREATE INDEX idx_customer_templates_active ON public.customer_templates(organization_id, is_active);

CREATE INDEX idx_customer_template_items_organization_id ON public.customer_template_items(organization_id);
CREATE INDEX idx_customer_template_items_template_id ON public.customer_template_items(template_id);
CREATE INDEX idx_customer_template_items_item_id ON public.customer_template_items(item_id);