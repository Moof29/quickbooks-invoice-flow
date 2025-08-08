import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Search, FileText, DollarSign, Plus, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { CreateSalesOrderDialog } from '@/components/CreateSalesOrderDialog';
import { GenerateTestDataButton } from '@/components/GenerateTestDataButton';
import { SalesOrderConvertToInvoiceButton } from '@/components/SalesOrderConvertToInvoiceButton';

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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleCreateSalesOrder = () => {
    setCreateDialogOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(sortedOrders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleRowClick = (orderId: string) => {
    navigate(`/sales-orders/${orderId}`);
  };

  // Sorting and helpers
  const [sortKey, setSortKey] = useState<keyof SalesOrder>('order_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: keyof SalesOrder) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

  const isToday = (dateString: string) => {
    const d = new Date(dateString);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
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
      (order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.memo && order.memo.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const sortedOrders = useMemo(() => {
    const arr = [...filteredOrders];
    arr.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      let va: any;
      let vb: any;

      if (sortKey === 'order_date' || sortKey === 'created_at') {
        va = new Date(a[sortKey] as string).getTime();
        vb = new Date(b[sortKey] as string).getTime();
      } else if (sortKey === 'total') {
        va = Number(a[sortKey]) || 0;
        vb = Number(b[sortKey]) || 0;
      } else {
        va = (a[sortKey] ?? '').toString().toLowerCase();
        vb = (b[sortKey] ?? '').toString().toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filteredOrders, sortKey, sortDirection]);

  const todaySalesTotal = filteredOrders
    .filter(o => isToday(o.order_date))
    .reduce((sum, o) => sum + (o.total || 0), 0);
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'invoiced':
        return 'default';
      case 'template_generated':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'invoiced':
        return 'Invoiced';
      case 'template_generated':
        return 'Auto Generated';
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sales Orders
            </div>
            <div className="flex gap-2">
              <GenerateTestDataButton />
              <Button onClick={handleCreateSalesOrder} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Sales Order
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            View and manage sales orders generated from customer templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          {filteredOrders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  <span className="text-sm font-medium">Total Sales Today</span>
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(todaySalesTotal)}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Pending vs Approved</span>
                </div>
                <p className="text-2xl font-bold">
                  {filteredOrders.filter(order => order.status === 'pending').length} / {filteredOrders.filter(order => order.status === 'approved').length}
                </p>
              </div>
            </div>
          )}

          {/* Filters - moved below summary */}
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="w-12 py-1">
                      <Checkbox
                        checked={selectedOrders.length === sortedOrders.length && sortedOrders.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all orders"
                      />
                    </TableHead>
                    <TableHead className="py-1">
                      <button type="button" onClick={() => handleSort('order_number')} className="flex items-center gap-1 hover:text-foreground">
                        Order Number <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TableHead>
                    <TableHead className="py-1">
                      <button type="button" onClick={() => handleSort('customer_name')} className="flex items-center gap-1 hover:text-foreground">
                        Customer <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TableHead>
                    <TableHead className="py-1">
                      <button type="button" onClick={() => handleSort('order_date')} className="flex items-center gap-1 hover:text-foreground">
                        Date <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TableHead>
                    <TableHead className="py-1">
                      <button type="button" onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-foreground">
                        Status <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right py-1">
                      <button type="button" onClick={() => handleSort('total')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                        Total <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[140px] py-1">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOrders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="h-8 cursor-pointer hover:bg-muted/50" 
                      onClick={() => handleRowClick(order.id)}
                    >
                      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                          aria-label={`Select order ${order.order_number}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium py-1">
                        {order.order_number}
                      </TableCell>
                      <TableCell className="py-1">{order.customer_name}</TableCell>
                      <TableCell className="py-1">
                        {format(new Date(order.order_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="py-1">
                        <Badge variant={getStatusVariant(order.status)}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium py-1">
                        {formatCurrency(order.total || 0)}
                      </TableCell>
                      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                        <SalesOrderConvertToInvoiceButton
                          salesOrderId={order.id}
                          currentStatus={order.status}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateSalesOrderDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
