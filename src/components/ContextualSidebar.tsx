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
import { format } from 'date-fns';

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
        .from('sales_order')
        .select(`
          id,
          order_number,
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
    <Sidebar className="w-80 border-l" side="right">
      <SidebarContent>
        <ScrollArea className="h-full">
          {currentModule === 'sales-orders' && (
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Recent Sales Orders
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {salesOrders?.map((order) => (
                    <SidebarMenuItem key={order.id}>
                      <SidebarMenuButton
                        onClick={() => navigate(`/sales-orders/${order.id}`)}
                        className={location.pathname === `/sales-orders/${order.id}` ? 'bg-accent' : ''}
                      >
                        <div className="flex flex-col items-start w-full">
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium text-sm">{order.order_number}</span>
                            <Badge variant={getStatusVariant(order.status)} className="text-xs">
                              {getStatusLabel(order.status)}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                            <span className="truncate max-w-[120px]">
                              {order.customer_profile?.company_name}
                            </span>
                            <span>${order.total?.toFixed(2) || '0.00'}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(order.order_date), 'MMM dd')}
                          </span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {currentModule === 'customers' && (
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customer List
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {customers?.map((customer) => (
                    <SidebarMenuItem key={customer.id}>
                      <SidebarMenuButton
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className={location.pathname === `/customers/${customer.id}` ? 'bg-accent' : ''}
                      >
                        <div className="flex flex-col items-start w-full">
                          <span className="font-medium text-sm truncate w-full">
                            {customer.company_name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate w-full">
                            {customer.email}
                          </span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {currentModule === 'items' && (
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Item Catalog
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items?.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => navigate(`/items/${item.id}`)}
                        className={location.pathname === `/items/${item.id}` ? 'bg-accent' : ''}
                      >
                        <div className="flex flex-col items-start w-full">
                          <span className="font-medium text-sm truncate w-full">
                            {item.name}
                          </span>
                          <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                            <span>{item.sku || 'No SKU'}</span>
                            <span>${item.purchase_cost?.toFixed(2) || '0.00'}</span>
                          </div>
                          {item.item_type && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {item.item_type}
                            </Badge>
                          )}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {currentModule === 'invoices' && invoices && invoices.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Recent Invoices
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-xs">Invoice module coming soon</p>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}