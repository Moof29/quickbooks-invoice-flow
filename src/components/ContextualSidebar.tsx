import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem 
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Users, Package, DollarSign } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function ContextualSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine current module based on route
  const getCurrentModule = () => {
    const path = location.pathname;
    if (path.startsWith('/sales-orders')) return 'sales-orders';
    if (path.startsWith('/customers')) return 'customers';
    if (path.startsWith('/invoices')) return 'invoices';
    if (path.startsWith('/items')) return 'items';
    return null;
  };

  const currentModule = getCurrentModule();

  // Sales Orders data
  const { data: salesOrders } = useQuery({
    queryKey: ['contextual-sales-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_record')
        .select(`
          id,
          invoice_number,
          status,
          total,
          order_date,
          customer_profile!inner(company_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: currentModule === 'sales-orders',
  });

  // Customers data
  const { data: customers } = useQuery({
    queryKey: ['contextual-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profile')
        .select('id, company_name, email')
        .order('company_name')
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: currentModule === 'customers',
  });

  // Items data
  const { data: items } = useQuery({
    queryKey: ['contextual-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_record')
        .select('id, name, sku, purchase_cost, item_type')
        .order('name')
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: currentModule === 'items',
  });

  // Invoices data - simplified query since invoice table may not exist yet
  const { data: invoices } = useQuery({
    queryKey: ['contextual-invoices'],
    queryFn: async () => {
      // Return empty array for now since invoice table structure is uncertain
      return [];
    },
    enabled: currentModule === 'invoices',
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'template_generated':
        return 'secondary';
      case 'draft':
        return 'outline';
      case 'open':
      case 'approved':
        return 'default';
      case 'shipped':
      case 'invoiced':
        return 'default';
      case 'closed':
        return 'secondary';
      case 'canceled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'template_generated':
        return 'Auto';
      case 'draft':
        return 'Draft';
      case 'open':
        return 'Open';
      case 'approved':
        return 'Approved';
      case 'shipped':
        return 'Shipped';
      case 'invoiced':
        return 'Invoiced';
      case 'closed':
        return 'Closed';
      case 'canceled':
        return 'Canceled';
      default:
        return status;
    }
  };

  if (!currentModule) {
    return null;
  }

  return (
    <div className="w-72 border-l bg-background">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          {currentModule === 'sales-orders' && <><FileText className="h-4 w-4" />Sales Orders</>}
          {currentModule === 'customers' && <><Users className="h-4 w-4" />Customers</>}
          {currentModule === 'items' && <><Package className="h-4 w-4" />Items</>}
          {currentModule === 'invoices' && <><DollarSign className="h-4 w-4" />Invoices</>}
        </h3>
      </div>
      
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-2">
          {currentModule === 'sales-orders' && (
            <div className="space-y-1">
              {salesOrders?.map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/sales-orders/${order.id}`)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/50 ${
                    location.pathname === `/sales-orders/${order.id}` ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{order.invoice_number}</span>
                    <Badge variant={getStatusVariant(order.status)} className="text-xs">
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground truncate" title={order.customer_profile?.company_name}>
                      {order.customer_profile?.company_name}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {format(parseISO(order.order_date + 'T00:00:00'), 'MMM dd, yyyy')}
                      </span>
                      <span className="font-medium">${order.total?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentModule === 'customers' && (
            <div className="space-y-1">
              {customers?.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/50 ${
                    location.pathname === `/customers/${customer.id}` ? 'bg-accent' : ''
                  }`}
                >
                  <div className="font-medium text-sm mb-1 truncate" title={customer.company_name}>
                    {customer.company_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" title={customer.email}>
                    {customer.email}
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentModule === 'items' && (
            <div className="space-y-1">
              {items?.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/items/${item.id}`)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/50 ${
                    location.pathname === `/items/${item.id}` ? 'bg-accent' : ''
                  }`}
                >
                  <div className="font-medium text-sm mb-1 truncate" title={item.name}>
                    {item.name}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.sku || 'No SKU'}</span>
                    <span className="font-medium">${item.purchase_cost?.toFixed(2) || '0.00'}</span>
                  </div>
                  {item.item_type && (
                    <Badge variant="outline" className="text-xs mt-1">
                      {item.item_type}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {currentModule === 'invoices' && (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">Invoice module coming soon</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}