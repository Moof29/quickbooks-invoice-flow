import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Search, FileText, DollarSign, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total: number;
  memo: string | null;
  customer_id: string;
  customer_name: string;
  created_at: string;
}

export function SalesOrdersList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();

  const handleCreateSalesOrder = () => {
    console.log('Create Sales Order button clicked');
    toast.info("Create Sales Order feature coming soon!");
  };

  // Fetch sales orders with customer names
  const { data: salesOrders, isLoading, error } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_order')
        .select(`
          id,
          order_number,
          order_date,
          status,
          total,
          memo,
          customer_id,
          created_at,
          customer_profile!inner(
            company_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sales orders:', error);
        throw error;
      }

      return (data || []).map(order => ({
        ...order,
        customer_name: order.customer_profile?.company_name || 'Unknown Customer'
      })) as SalesOrder[];
    },
  });

  // Filter sales orders based on search and status
  const filteredOrders = salesOrders?.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.memo && order.memo.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'template_generated':
        return 'secondary';
      case 'draft':
        return 'outline';
      case 'open':
        return 'default';
      case 'approved':
        return 'default';
      case 'shipped':
        return 'default';
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
        return 'Auto-Generated';
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Orders</CardTitle>
          <CardDescription>Loading sales orders...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Orders</CardTitle>
          <CardDescription>Error loading sales orders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            <p>Failed to load sales orders. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sales Orders
          </div>
          <Button onClick={handleCreateSalesOrder} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Sales Order
          </Button>
        </CardTitle>
        <CardDescription>
          View and manage sales orders generated from customer templates
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by order number, customer, or memo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="template_generated">Auto-Generated</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="invoiced">Invoiced</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        {filteredOrders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Orders</span>
              </div>
              <p className="text-2xl font-bold">{filteredOrders.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Value</span>
              </div>
              <p className="text-2xl font-bold">
                ${filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Auto-Generated</span>
              </div>
              <p className="text-2xl font-bold">
                {filteredOrders.filter(order => order.status === 'template_generated').length}
              </p>
            </div>
          </div>
        )}

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No sales orders found</p>
            <p className="text-sm">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search criteria'
                : 'Create customer templates to automatically generate sales orders'
              }
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell>
                      {format(new Date(order.order_date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(order.status)}>
                        {getStatusLabel(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${order.total?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {order.memo || '-'}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/sales-orders/${order.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}