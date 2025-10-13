
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { ClearInvoicesButton } from '@/components/ClearInvoicesButton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Plus,
  Eye,
  Edit,
  Trash2,
  Download,
  Send,
  MoreHorizontal,
  FileText,
  DollarSign,
  Clock,
  CheckCircle2,
  Search,
  ArrowUpDown,
  Filter,
  CalendarIcon,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InvoiceDialog } from '@/components/InvoiceDialog';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
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
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dateType, setDateType] = useState<'invoice_date' | 'due_date'>('invoice_date');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const { toast } = useToast();

  const statusOptions = [
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
  ];

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_record')
        .select(`
          id, 
          invoice_number, 
          invoice_date, 
          due_date, 
          total, 
          status,
          customer_profile:customer_id (
            display_name,
            company_name,
            email
          )
        `)
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

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'draft':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // Get unique customers for filter
  const uniqueCustomers = Array.from(
    new Set(
      invoices.map(inv => 
        inv.customer_profile?.company_name || inv.customer_profile?.display_name || 'Unknown'
      )
    )
  ).sort();

  // Filter and sort invoices
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = searchTerm === '' || 
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_profile?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter.length === 0 || 
      statusFilter.includes(invoice.status?.toLowerCase() || '');
    
    const customerName = invoice.customer_profile?.company_name || invoice.customer_profile?.display_name || 'Unknown';
    const matchesCustomer = customerFilter.length === 0 || customerFilter.includes(customerName);
    
    // Date range filter
    let matchesDateRange = true;
    if (dateFrom || dateTo) {
      const dateToCheck = dateType === 'invoice_date' ? invoice.invoice_date : invoice.due_date;
      if (dateToCheck) {
        const invoiceDate = new Date(dateToCheck);
        if (dateFrom && invoiceDate < dateFrom) {
          matchesDateRange = false;
        }
        if (dateTo && invoiceDate > dateTo) {
          matchesDateRange = false;
        }
      } else {
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
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleCustomer = (customer: string) => {
    setCustomerFilter(prev =>
      prev.includes(customer)
        ? prev.filter(c => c !== customer)
        : [...prev, customer]
    );
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const toggleAllInvoices = () => {
    if (selectedInvoices.length === invoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(invoices.map(inv => inv.id));
    }
  };

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const paidInvoices = invoices.filter(inv => inv.status?.toLowerCase() === 'paid');
  const pendingInvoices = invoices.filter(inv => inv.status?.toLowerCase() === 'pending');
  const overdueInvoices = invoices.filter(inv => inv.status?.toLowerCase() === 'overdue');

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('invoice_record')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });

      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage and track all your invoices</p>
        </div>
        <div className="flex gap-2">
          <ClearInvoicesButton />
          <Button onClick={() => setShowInvoiceDialog(true)} size="default">
            <Plus className="w-4 h-4 mr-2" />
            Create New Invoice
          </Button>
        </div>
      </div>

      {/* Search, Filter, and Sort */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Date Type Selector */}
            <Select value={dateType} onValueChange={(value: 'invoice_date' | 'due_date') => setDateType(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice_date">Invoice Date</SelectItem>
                <SelectItem value="due_date">Due Date</SelectItem>
              </SelectContent>
            </Select>

            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[150px] justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[150px] justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "MMM dd, yyyy") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* Clear Date Filter */}
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            {/* Status Filter - Multi-select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start">
                  <Filter className="h-4 w-4 mr-2" />
                  {statusFilter.length === 0
                    ? "All Status"
                    : statusFilter.length === 1
                    ? statusOptions.find(s => s.value === statusFilter[0])?.label
                    : `${statusFilter.length} statuses`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <div className="p-4 space-y-2 bg-popover">
                  <div className="font-medium text-sm mb-2">Filter by Status</div>
                  {statusOptions.map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={status.value}
                        checked={statusFilter.includes(status.value)}
                        onCheckedChange={() => toggleStatus(status.value)}
                      />
                      <label
                        htmlFor={status.value}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {status.label}
                      </label>
                    </div>
                  ))}
                  {statusFilter.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setStatusFilter([])}
                    >
                      Clear All
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Customer Filter - Multi-select with Search */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start">
                  <Filter className="h-4 w-4 mr-2" />
                  {customerFilter.length === 0
                    ? "All Customers"
                    : customerFilter.length === 1
                    ? customerFilter[0]
                    : `${customerFilter.length} customers`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <div className="p-4 space-y-3 bg-popover">
                  <div className="font-medium text-sm">Filter by Customer</div>
                  
                  {/* Customer Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>

                  {/* Customer List */}
                  <div className="max-h-[240px] overflow-y-auto space-y-2">
                    {uniqueCustomers
                      .filter(customer => 
                        customer.toLowerCase().includes(customerSearch.toLowerCase())
                      )
                      .map((customer) => (
                        <div key={customer} className="flex items-center space-x-2">
                          <Checkbox
                            id={`customer-${customer}`}
                            checked={customerFilter.includes(customer)}
                            onCheckedChange={() => toggleCustomer(customer)}
                          />
                          <label
                            htmlFor={`customer-${customer}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            {customer}
                          </label>
                        </div>
                      ))}
                    {uniqueCustomers.filter(customer => 
                      customer.toLowerCase().includes(customerSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No customers found
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    {customerFilter.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={() => setCustomerFilter([])}
                      >
                        Clear All
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setCustomerSearch('')}
                    >
                      Reset Search
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Export Button */}
            <Button variant="outline" size="default">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Invoice Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">All Invoices</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                {filteredInvoices.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            {selectedInvoices.length > 0 && (
              <Badge variant="secondary" className="text-xs font-medium">
                {selectedInvoices.length} selected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredInvoices.length === 0 ? (
              <div className="text-center py-16">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No invoices found</h3>
                <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
                  {searchTerm ? 'Try adjusting your search criteria to find what you\'re looking for' : 'Get started by creating your first invoice to track payments'}
                </p>
                <Button onClick={() => setShowInvoiceDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                        onCheckedChange={toggleAllInvoices}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('invoice_number')}
                      >
                        Invoice Number
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('customer')}
                      >
                        Customer
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('invoice_date')}
                      >
                        Invoice Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('due_date')}
                      >
                        Due Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('amount')}
                      >
                        Amount
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('status')}
                      >
                        Status
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedInvoices.includes(invoice.id)}
                          onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                          aria-label={`Select invoice ${invoice.invoice_number}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {invoice.invoice_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                              {(invoice.customer_profile?.company_name || invoice.customer_profile?.display_name || 'CU').substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {invoice.customer_profile?.company_name || invoice.customer_profile?.display_name || 'N/A'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {invoice.customer_profile?.email || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-sm">
                          ${invoice.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusVariant(invoice.status)}
                          className="font-medium capitalize"
                        >
                          {invoice.status || 'draft'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => window.location.href = `/invoices/${invoice.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.location.href = `/invoices/${invoice.id}`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Send className="mr-2 h-4 w-4" />
                              Send to Customer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteInvoice(invoice.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      <InvoiceDialog 
        open={showInvoiceDialog} 
        onOpenChange={setShowInvoiceDialog}
        onSuccess={loadInvoices}
      />
    </div>
  );
};

export default Invoices;
