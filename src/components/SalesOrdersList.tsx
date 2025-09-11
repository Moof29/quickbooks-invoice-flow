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
import { Calendar, Search, FileText, DollarSign, Plus, ArrowUpDown, Truck } from 'lucide-react';
import { format, isToday, isPast, isTomorrow } from 'date-fns';
import { CreateSalesOrderDialog } from '@/components/CreateSalesOrderDialog';
import { GenerateTestDataButton } from '@/components/GenerateTestDataButton';
import { SalesOrderConvertToInvoiceButton } from '@/components/SalesOrderConvertToInvoiceButton';

import { cn } from '@/lib/utils';

interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date: string;
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
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<Date | null>(null);
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

  // Sorting and helpers - default sort by delivery_date
  const [sortKey, setSortKey] = useState<keyof SalesOrder>('delivery_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const getDeliveryRowClass = (deliveryDate: string) => {
    const date = new Date(deliveryDate);
    if (isTomorrow(date)) return 'bg-green-50 hover:bg-green-100 border-l-4 border-l-green-500';
    if (isToday(date)) return 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500';
    if (isPast(date)) return 'bg-gray-50 hover:bg-gray-100 border-l-4 border-l-gray-400 opacity-75';
    return '';
  };

  const getDeliveryBadgeVariant = (deliveryDate: string) => {
    const date = new Date(deliveryDate);
    if (isTomorrow(date)) return 'default';
    if (isToday(date)) return 'secondary';
    if (isPast(date)) return 'outline';
    return 'default';
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
          delivery_date,
          status,
          total,
          memo,
          customer_id,
          created_at,
          customer_profile!inner(
            company_name
          )
        `)
        .order('delivery_date', { ascending: true });

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

  // Filter sales orders based on search, status, and delivery date
  const filteredOrders = salesOrders?.filter(order => {
    const matchesSearch = 
      (order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.memo && order.memo.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    const matchesDeliveryDate = !selectedDeliveryDate || 
      format(new Date(order.delivery_date), 'yyyy-MM-dd') === format(selectedDeliveryDate, 'yyyy-MM-dd');
    
    return matchesSearch && matchesStatus && matchesDeliveryDate;
  }) || [];

  const sortedOrders = useMemo(() => {
    const arr = [...filteredOrders];
    arr.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      let va: any;
      let vb: any;

      if (sortKey === 'order_date' || sortKey === 'created_at' || sortKey === 'delivery_date') {
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
        <CardContent className="p-6 space-y-6">
          {/* Summary Stats */}
          {filteredOrders.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
              <Card className="bg-muted/30 border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground truncate">Total Orders</p>
                      <p className="text-lg font-bold text-foreground">{filteredOrders.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-muted/30 border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground truncate">Sales Today</p>
                      <p className="text-lg font-bold text-foreground truncate">
                        {formatCurrency(todaySalesTotal)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-muted/30 border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground truncate">Pending / Approved</p>
                      <p className="text-lg font-bold text-foreground">
                        {filteredOrders.filter(order => order.status === 'pending').length} / {filteredOrders.filter(order => order.status === 'approved').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-4">
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
            <Select value={selectedDeliveryDate ? format(selectedDeliveryDate, 'yyyy-MM-dd') : ''} onValueChange={(value) => setSelectedDeliveryDate(value ? new Date(value) : null)}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Filter by delivery date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Delivery Dates</SelectItem>
                {Array.from({ length: 14 }, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i - 2); // 2 days ago to 11 days ahead
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const displayStr = format(date, 'EEEE, MMM dd, yyyy');
                  const isToday = i === 2;
                  const isTomorrow = i === 3;
                  
                  return (
                    <SelectItem key={dateStr} value={dateStr}>
                      {isToday ? `Today - ${displayStr}` : 
                       isTomorrow ? `Tomorrow - ${displayStr}` : 
                       displayStr}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          {/* Active Filters */}
          {selectedDeliveryDate && (
            <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">
                  Showing orders for: {format(selectedDeliveryDate, 'EEEE, MMM dd, yyyy')}
                </p>
              </div>
            </div>
          )}

          {/* Orders Table */}
          {filteredOrders.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No sales orders found</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search criteria to find what you\'re looking for'
                  : 'Create customer templates to automatically generate sales orders'
                }
              </p>
            </div>
          ) : (
            <div className="table-container">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="h-12 bg-muted/20">
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
                      <button type="button" onClick={() => handleSort('delivery_date')} className="flex items-center gap-1 hover:text-foreground">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                        Delivery Date <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TableHead>
                    <TableHead className="py-1">
                      <button type="button" onClick={() => handleSort('order_date')} className="flex items-center gap-1 hover:text-foreground">
                        Order Date <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
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
                      className={cn(
                        "h-10 cursor-pointer hover:bg-muted/50",
                        getDeliveryRowClass(order.delivery_date)
                      )}
                      onClick={() => handleRowClick(order.id)}
                    >
                      <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                          aria-label={`Select order ${order.order_number}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium py-2">
                        {order.order_number}
                      </TableCell>
                      <TableCell className="py-2">{order.customer_name}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getDeliveryBadgeVariant(order.delivery_date)} className="text-xs">
                            {format(new Date(order.delivery_date), 'MMM dd')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(order.delivery_date), 'EEE')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {format(new Date(order.order_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={getStatusVariant(order.status)}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium py-2">
                        {formatCurrency(order.total || 0)}
                      </TableCell>
                      <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="min-h-[32px] flex items-center">
                          <SalesOrderConvertToInvoiceButton
                            salesOrderId={order.id}
                            currentStatus={order.status}
                          />
                        </div>
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
