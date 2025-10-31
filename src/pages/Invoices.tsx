import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClearInvoicesButton } from '@/components/ClearInvoicesButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus,
  Eye,
  MoreHorizontal,
  FileText,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InvoiceDialog } from '@/components/InvoiceDialog';
import { InvoicePreviewDialog } from '@/components/InvoicePreviewDialog';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  amount_paid?: number;
  amount_due?: number;
  status: string;
  customer_profile?: {
    display_name: string;
    company_name: string;
    email: string;
  };
}

const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: [] as string[],
    customer: [] as string[],
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadInvoices();
  }, []);

  // Real-time subscription for invoice changes (exclude pending)
  useEffect(() => {
    const channel = supabase
      .channel('invoice-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'invoice_record',
          filter: 'status=neq.pending'  // ← Exclude pending staging records
        },
        (payload) => {
          console.log('Invoice change detected:', payload);
          loadInvoices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('invoice_record')
        .select(`
          id, 
          invoice_number, 
          invoice_date, 
          due_date, 
          total,
          amount_paid,
          amount_due,
          status,
          customer_profile:customer_id (
            display_name,
            company_name,
            email
          )
        `)
        .in('status', ['invoiced', 'sent', 'paid', 'cancelled', 'confirmed', 'delivered', 'overdue'])  // ← Exclude 'pending'
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string, amountDue: number): "default" | "secondary" | "destructive" | "outline" => {
    if (amountDue === 0) return 'default';
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'default';
      case 'sent':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'draft':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const uniqueCustomers = Array.from(
    new Set(
      invoices.map(inv => 
        inv.customer_profile?.company_name || inv.customer_profile?.display_name || 'Unknown'
      )
    )
  ).sort();

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = searchTerm === '' || 
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_profile?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filters.status.length === 0 || 
      filters.status.includes(invoice.status?.toLowerCase() || '');
    
    const customerName = invoice.customer_profile?.company_name || invoice.customer_profile?.display_name || 'Unknown';
    const matchesCustomer = filters.customer.length === 0 || filters.customer.includes(customerName);
    
    let matchesDateRange = true;
    if (filters.dateFrom || filters.dateTo) {
      const invoiceDate = new Date(invoice.invoice_date);
      if (filters.dateFrom && invoiceDate < new Date(filters.dateFrom)) {
        matchesDateRange = false;
      }
      if (filters.dateTo && invoiceDate > new Date(filters.dateTo)) {
        matchesDateRange = false;
      }
    }
    
    return matchesSearch && matchesStatus && matchesCustomer && matchesDateRange;
  }).sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (sortField) {
      case 'invoice_number':
        aValue = a.invoice_number || '';
        bValue = b.invoice_number || '';
        break;
      case 'customer':
        aValue = a.customer_profile?.company_name || a.customer_profile?.display_name || '';
        bValue = b.customer_profile?.company_name || b.customer_profile?.display_name || '';
        break;
      case 'invoice_date':
        aValue = new Date(a.invoice_date || 0).getTime();
        bValue = new Date(b.invoice_date || 0).getTime();
        break;
      case 'due_date':
        aValue = new Date(a.due_date || 0).getTime();
        bValue = new Date(b.due_date || 0).getTime();
        break;
      case 'amount':
        aValue = a.total || 0;
        bValue = b.total || 0;
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const toggleStatus = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const toggleCustomer = (customer: string) => {
    setFilters(prev => ({
      ...prev,
      customer: prev.customer.includes(customer)
        ? prev.customer.filter(c => c !== customer)
        : [...prev.customer, customer]
    }));
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const toggleAllInvoices = () => {
    if (selectedInvoices.length === paginatedInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(paginatedInvoices.map(inv => inv.id));
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    try {
      const { error } = await supabase
        .from('invoice_record')
        .delete()
        .eq('id', invoiceToDelete);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invoice deleted successfully',
      });

      loadInvoices();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete invoice',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handleRowClick = (invoiceId: string) => {
    setPreviewInvoiceId(invoiceId);
    setShowPreviewDialog(true);
  };

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading invoices...</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Invoices</h2>
              <p className="text-sm md:text-base text-muted-foreground">
                Manage and track your invoices
              </p>
            </div>
            <div className="hidden md:flex gap-2">
              <ClearInvoicesButton />
              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create New Invoice
              </Button>
            </div>
          </div>
          
          {/* Mobile FAB */}
          <div className="md:hidden fixed bottom-20 right-4 z-50">
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>

          {/* Filters and Search */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Filter Invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Search - Full width on mobile */}
              <div className="space-y-2">
                <Label className="text-sm">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Invoice number, customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Date Range */}
                <div className="space-y-2">
                  <Label className="text-sm">Date Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      placeholder="From"
                    />
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      placeholder="To"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label className="text-sm">Status</Label>
                  <Select 
                    value={filters.status[0] || 'all'}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        setFilters({ ...filters, status: [] });
                      } else {
                        toggleStatus(value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer Filter */}
                <div className="space-y-2">
                  <Label className="text-sm">Customer</Label>
                  <Select 
                    value={filters.customer[0] || 'all'}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        setFilters({ ...filters, customer: [] });
                      } else {
                        toggleCustomer(value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Customers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      {uniqueCustomers.map(customer => (
                        <SelectItem key={customer} value={customer}>
                          {customer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reset Filters Button */}
              {(searchTerm || filters.dateFrom || filters.dateTo || filters.status.length > 0 || filters.customer.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setFilters({ dateFrom: '', dateTo: '', status: [], customer: [] });
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Desktop & Tablet Table View */}
          <Card className="border-0 shadow-sm hidden sm:block">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>All Invoices</CardTitle>
                <CardDescription>
                  {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
                </CardDescription>
              </div>
              
              {selectedInvoices.length > 0 && (
                <Badge variant="secondary">
                  {selectedInvoices.length} selected
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedInvoices.length === paginatedInvoices.length && paginatedInvoices.length > 0}
                        onCheckedChange={toggleAllInvoices}
                      />
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('invoice_number')}>
                        Invoice #
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('customer')}>
                        Customer
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('invoice_date')}>
                        Invoice Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('due_date')}>
                        Due Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('amount')}>
                        Amount
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('status')}>
                        Status
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No invoices found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedInvoices.map((invoice) => (
                      <TableRow 
                        key={invoice.id} 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleRowClick(invoice.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedInvoices.includes(invoice.id)}
                            onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {(invoice.customer_profile?.company_name || invoice.customer_profile?.display_name || 'CU').substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">
                                {invoice.customer_profile?.company_name || invoice.customer_profile?.display_name || 'N/A'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {invoice.customer_profile?.email || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${invoice.total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(invoice.status, invoice.amount_due || 0)}>
                            {invoice.amount_due === 0 ? 'Paid' : invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => window.location.href = `/invoices/${invoice.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-muted-foreground">
                {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            {paginatedInvoices.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No invoices found</p>
                </CardContent>
              </Card>
            ) : (
              paginatedInvoices.map((invoice) => (
                <Card 
                  key={invoice.id} 
                  className="border-0 shadow-sm active:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleRowClick(invoice.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base truncate">
                            {invoice.invoice_number}
                          </h3>
                          <Badge 
                            variant={getStatusVariant(invoice.status, invoice.amount_due || 0)}
                            className="shrink-0"
                          >
                            {invoice.amount_due === 0 ? 'Paid' : invoice.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {invoice.customer_profile?.display_name || 'No Customer'}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="font-semibold text-base">
                          ${invoice.total.toFixed(2)}
                        </p>
                        {(invoice.amount_due ?? invoice.total) > 0 && (
                          <p className="text-xs text-destructive">
                            ${(invoice.amount_due ?? invoice.total).toFixed(2)} due
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="block">Invoice Date</span>
                        <span className="font-medium text-foreground">
                          {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div>
                        <span className="block">Due Date</span>
                        <span className="font-medium text-foreground">
                          {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full md:w-auto justify-center">
                  <span className="text-sm text-muted-foreground">Rows:</span>
                  <Select 
                    value={itemsPerPage === filteredInvoices.length ? "all" : String(itemsPerPage)} 
                    onValueChange={(value) => {
                      if (value === "all") {
                        setItemsPerPage(filteredInvoices.length);
                        setCurrentPage(1);
                      } else {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">
                    {startIndex + 1}-{Math.min(endIndex, filteredInvoices.length)} of {filteredInvoices.length}
                  </span>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <InvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadInvoices}
      />

      {previewInvoiceId && (
        <InvoicePreviewDialog
          invoiceId={previewInvoiceId}
          open={showPreviewDialog}
          onOpenChange={setShowPreviewDialog}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInvoiceToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Invoices;