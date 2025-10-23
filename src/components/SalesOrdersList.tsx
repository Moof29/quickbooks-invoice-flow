import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Search, FileText, DollarSign, Plus, ArrowUpDown, Truck, Download, Trash2, CircleCheck as CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isPast, isTomorrow } from 'date-fns';
import { CreateSalesOrderDialog } from '@/components/CreateSalesOrderDialog';
import { GenerateTestDataButton } from '@/components/GenerateTestDataButton';

import { cn } from '@/lib/utils';

interface SalesOrder {
  id: string;
  invoice_number: string;
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('invoice_record') as any)
        .select(`
          id,
          invoice_number,
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
      (order.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
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

  const deleteMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const { error } = await supabase
        .from('invoice_record')
        .delete()
        .in('id', orderIds);

      if (error) throw error;
    },
    onSuccess: (_, orderIds) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedOrders([]);
      toast.success('Orders deleted', { 
        description: `Successfully deleted ${orderIds.length} order${orderIds.length !== 1 ? 's' : ''}` 
      });
    },
    onError: (error: any) => {
      toast.error('Failed to delete orders', {
        description: error.message
      });
    },
  });

  const handleDeleteSelected = () => {
    if (selectedOrders.length === 0) {
      toast.error('No orders selected', { description: 'Please select at least one order to delete' });
      return;
    }

    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate(selectedOrders);
    setDeleteDialogOpen(false);
  };

  const handleExportCSV = () => {
    if (selectedOrders.length === 0) {
      toast.error('No orders selected', { description: 'Please select at least one order to export' });
      return;
    }

    const ordersToExport = sortedOrders.filter(o => selectedOrders.includes(o.id));
    const csvHeaders = ['Order Number', 'Customer', 'Order Date', 'Delivery Date', 'Status', 'Total'];
    const csvRows = ordersToExport.map(o => [
      o.invoice_number,
      o.customer_name,
      format(new Date(o.order_date), 'yyyy-MM-dd'),
      format(new Date(o.delivery_date), 'yyyy-MM-dd'),
      getStatusLabel(o.status),
      o.total.toFixed(2)
    ]);

    const csv = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Export complete', { description: `Exported ${selectedOrders.length} orders to CSV` });
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'draft':
        return 'outline';
      case 'pending':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'fulfilled':
      case 'shipped':
        return 'default';
      case 'invoiced':
        return 'default';
      case 'closed':
        return 'outline';
      case 'canceled':
        return 'destructive';
      case 'template_generated':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'pending':
        return 'Pending Approval';
      case 'approved':
        return 'Approved';
      case 'fulfilled':
        return 'Fulfilled';
      case 'shipped':
        return 'Shipped';
      case 'invoiced':
        return 'Invoiced';
      case 'closed':
        return 'Closed';
      case 'canceled':
        return 'Canceled';
      case 'template_generated':
        return 'Auto-Generated';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
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

  const ordersToDelete = sortedOrders.filter(o => selectedOrders.includes(o.id));

  return (
    <>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <AlertDialogTitle className="text-xl">Delete Sales Orders</AlertDialogTitle>
                <AlertDialogDescription className="mt-2">
                  Are you sure you want to delete {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''}? This action cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="my-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium mb-3">Orders to be deleted:</p>
              <ScrollArea className="h-[200px] w-full rounded-md border bg-background">
                <div className="min-h-[200px] p-4 space-y-2 border-l-4 border-orange-500">
                  {ordersToDelete.map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 hover:bg-muted">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium">{order.invoice_number}</span>
                        <span className="text-sm text-muted-foreground">{order.customer_name}</span>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(order.total)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : `Delete ${selectedOrders.length} Order${selectedOrders.length !== 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedDeliveryDate ? format(selectedDeliveryDate, 'yyyy-MM-dd') : 'all'} onValueChange={(value) => setSelectedDeliveryDate(value === 'all' ? null : new Date(value))}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Filter by delivery date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Delivery Dates</SelectItem>
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
          
          {/* Bulk Actions Toolbar */}
          {selectedOrders.length > 0 && (
            <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium">
                  {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportCSV}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDeleteSelected}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete Selected'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedOrders([]);
                      toast.info('Selection cleared');
                    }}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Active Filters */}
          {selectedDeliveryDate && (
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
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
                      <button type="button" onClick={() => handleSort('invoice_number')} className="flex items-center gap-1 hover:text-foreground">
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
                          aria-label={`Select order ${order.invoice_number}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium py-2">
                        {order.invoice_number}
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
