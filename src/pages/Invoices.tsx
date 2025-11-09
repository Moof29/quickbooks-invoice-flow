import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
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
  SlidersHorizontal,
  X,
  ChevronDown,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
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
  memo?: string;
  customer_profile?: {
    display_name: string;
    company_name: string;
    email: string;
  };
}

// Customer name filtering is now done server-side for better performance

const Invoices = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: [] as string[],
    customer: [] as string[],
  });
  
  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState({
    minAmount: '',
    maxAmount: '',
    amountDueOnly: false,
    includePartiallyPaid: true,
    customerIds: [] as string[],
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.dateFrom, filters.dateTo, filters.status, advancedFilters]);

  // Fetch total count for pagination
  const { data: totalCount = 0 } = useQuery<number>({
    queryKey: ['invoices-count', debouncedSearch, filters, advancedFilters],
    queryFn: async () => {
      // Step 1: If searching text, find matching customers first
      let matchingCustomerIds: string[] = [];
      
      if (debouncedSearch && !/^\d+\.?\d*$/.test(debouncedSearch)) {
        const searchValue = debouncedSearch.trim();
        const { data: customers } = await supabase
          .from('customer_profile')
          .select('id')
          .or(
            `display_name.ilike.%${searchValue}%,` +
            `company_name.ilike.%${searchValue}%,` +
            `email.ilike.%${searchValue}%`
          );
        
        matchingCustomerIds = customers?.map(c => c.id) || [];
      }

      // Step 2: Query invoices
      let query = supabase
        .from('invoice_record')
        .select('*', { count: 'exact', head: true })
        .in('status', ['invoiced', 'sent', 'paid', 'cancelled', 'confirmed', 'delivered', 'overdue']);

      // Apply search filter - smart search across invoice fields AND customers
      if (debouncedSearch) {
        const searchValue = debouncedSearch.trim();
        const isNumeric = /^\d+\.?\d*$/.test(searchValue);

        if (isNumeric) {
          // Numeric search: search invoice number OR amounts
          const numericValue = parseFloat(searchValue);
          query = query.or(
            `invoice_number.ilike.%${searchValue}%,` +
            `total.eq.${numericValue},` +
            `amount_due.eq.${numericValue}`
          );
        } else {
          // Text search: invoice number, memo, OR customer IDs
          if (matchingCustomerIds.length > 0) {
            query = query.or(
              `invoice_number.ilike.%${searchValue}%,` +
              `memo.ilike.%${searchValue}%,` +
              `customer_id.in.(${matchingCustomerIds.join(',')})`
            );
          } else {
            // No customers found, just search invoice fields
            query = query.or(
              `invoice_number.ilike.%${searchValue}%,` +
              `memo.ilike.%${searchValue}%`
            );
          }
        }
      }

      // Apply status filter
      if (filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      // Apply date range filter
      if (filters.dateFrom) {
        query = query.gte('invoice_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('invoice_date', filters.dateTo);
      }

      // Apply advanced filters
      if (advancedFilters.minAmount) {
        query = query.gte('total', parseFloat(advancedFilters.minAmount));
      }
      if (advancedFilters.maxAmount) {
        query = query.lte('total', parseFloat(advancedFilters.maxAmount));
      }
      if (advancedFilters.amountDueOnly) {
        query = query.gt('amount_due', 0);
      }
      if (advancedFilters.customerIds.length > 0) {
        query = query.in('customer_id', advancedFilters.customerIds);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }
  });

  // Fetch paginated invoices
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', currentPage, debouncedSearch, sortField, sortOrder, filters, advancedFilters],
    queryFn: async () => {
      // Step 1: If searching text, find matching customers first
      let matchingCustomerIds: string[] = [];
      
      if (debouncedSearch && !/^\d+\.?\d*$/.test(debouncedSearch)) {
        const searchValue = debouncedSearch.trim();
        const { data: customers } = await supabase
          .from('customer_profile')
          .select('id')
          .or(
            `display_name.ilike.%${searchValue}%,` +
            `company_name.ilike.%${searchValue}%,` +
            `email.ilike.%${searchValue}%`
          );
        
        matchingCustomerIds = customers?.map(c => c.id) || [];
      }

      // Step 2: Query invoices with pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
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
          memo,
          customer_profile:customer_id (
            display_name,
            company_name,
            email
          )
        `)
        .in('status', ['invoiced', 'sent', 'paid', 'cancelled', 'confirmed', 'delivered', 'overdue'])
        .range(from, to);

      // Apply search filter - smart search across invoice fields AND customers
      if (debouncedSearch) {
        const searchValue = debouncedSearch.trim();
        const isNumeric = /^\d+\.?\d*$/.test(searchValue);

        if (isNumeric) {
          // Numeric search: search invoice number OR amounts
          const numericValue = parseFloat(searchValue);
          query = query.or(
            `invoice_number.ilike.%${searchValue}%,` +
            `total.eq.${numericValue},` +
            `amount_due.eq.${numericValue}`
          );
        } else {
          // Text search: invoice number, memo, OR customer IDs
          if (matchingCustomerIds.length > 0) {
            query = query.or(
              `invoice_number.ilike.%${searchValue}%,` +
              `memo.ilike.%${searchValue}%,` +
              `customer_id.in.(${matchingCustomerIds.join(',')})`
            );
          } else {
            // No customers found, just search invoice fields
            query = query.or(
              `invoice_number.ilike.%${searchValue}%,` +
              `memo.ilike.%${searchValue}%`
            );
          }
        }
      }

      // Apply status filter
      if (filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      // Apply date range filter
      if (filters.dateFrom) {
        query = query.gte('invoice_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('invoice_date', filters.dateTo);
      }

      // Apply advanced filters
      if (advancedFilters.minAmount) {
        query = query.gte('total', parseFloat(advancedFilters.minAmount));
      }
      if (advancedFilters.maxAmount) {
        query = query.lte('total', parseFloat(advancedFilters.maxAmount));
      }
      if (advancedFilters.amountDueOnly) {
        query = query.gt('amount_due', 0);
      }
      if (advancedFilters.customerIds.length > 0) {
        query = query.in('customer_id', advancedFilters.customerIds);
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      switch (sortField) {
        case 'invoice_number':
          query = query.order('invoice_number', { ascending });
          break;
        case 'invoice_date':
          query = query.order('invoice_date', { ascending });
          break;
        case 'due_date':
          query = query.order('due_date', { ascending });
          break;
        case 'amount':
          query = query.order('total', { ascending });
          break;
        case 'status':
          query = query.order('status', { ascending });
          break;
        default:
          query = query.order('created_at', { ascending });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

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
          filter: 'status=neq.pending'
        },
        (payload) => {
          console.log('Invoice change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
          queryClient.invalidateQueries({ queryKey: ['invoices-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const loadInvoices = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoices-count'] });
  };

  const getStatusVariant = (status: string, amountDue: number): { variant: "default" | "secondary" | "destructive" | "outline"; className: string } => {
    // Paid invoices (amount_due = 0)
    if (amountDue === 0) {
      return { variant: 'default', className: 'bg-green-100 text-green-800' };
    }
    
    // Status-based colors
    switch (status?.toLowerCase()) {
      case 'paid':
        return { variant: 'default', className: 'bg-green-100 text-green-800' };
      case 'sent':
      case 'invoiced':
      case 'confirmed':
        return { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800' };
      case 'overdue':
        return { variant: 'destructive', className: 'bg-red-100 text-red-800' };
      case 'cancelled':
        return { variant: 'destructive', className: 'bg-red-100 text-red-800' };
      case 'delivered':
        return { variant: 'default', className: 'bg-green-100 text-green-800' };
      default:
        return { variant: 'outline', className: '' };
    }
  };

  // No longer needed - filtering happens server-side

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
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
      {isLoading && invoices.length === 0 ? (
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
                    placeholder="Search by customer name, invoice #, or memo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {searchTerm && (
                  <p className="text-xs text-muted-foreground">
                    {/^\d+\.?\d*$/.test(searchTerm)
                      ? `Searching for invoice #${searchTerm} or amounts of $${searchTerm}`
                      : `Searching customer names, invoice numbers, and memos`
                    }
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              </div>

              {/* Reset Filters Button */}
              {(searchTerm || filters.dateFrom || filters.dateTo || filters.status.length > 0 ||
                advancedFilters.minAmount || advancedFilters.maxAmount || advancedFilters.amountDueOnly) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setFilters({ dateFrom: '', dateTo: '', status: [], customer: [] });
                    setAdvancedFilters({
                      minAmount: '',
                      maxAmount: '',
                      amountDueOnly: false,
                      includePartiallyPaid: true,
                      customerIds: []
                    });
                  }}
                  className="w-full"
                >
                  Clear All Filters
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Active Filter Chips */}
          {(advancedFilters.minAmount || advancedFilters.maxAmount || advancedFilters.amountDueOnly) && (
            <div className="flex flex-wrap gap-2">
              {advancedFilters.minAmount && (
                <Badge variant="secondary" className="gap-1">
                  Min: ${advancedFilters.minAmount}
                  <button
                    onClick={() => setAdvancedFilters({ ...advancedFilters, minAmount: '' })}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {advancedFilters.maxAmount && (
                <Badge variant="secondary" className="gap-1">
                  Max: ${advancedFilters.maxAmount}
                  <button
                    onClick={() => setAdvancedFilters({ ...advancedFilters, maxAmount: '' })}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {advancedFilters.amountDueOnly && (
                <Badge variant="secondary" className="gap-1">
                  Unpaid only
                  <button
                    onClick={() => setAdvancedFilters({ ...advancedFilters, amountDueOnly: false })}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}

          {/* Advanced Filters */}
          <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="font-semibold">Advanced Filters</span>
                      {(advancedFilters.minAmount || advancedFilters.maxAmount || advancedFilters.amountDueOnly || advancedFilters.customerIds.length > 0) && (
                        <Badge variant="secondary" className="ml-2">
                          {[
                            advancedFilters.minAmount && 'Min',
                            advancedFilters.maxAmount && 'Max',
                            advancedFilters.amountDueOnly && 'Unpaid',
                            advancedFilters.customerIds.length > 0 && `${advancedFilters.customerIds.length} customers`
                          ].filter(Boolean).length} active
                        </Badge>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  {/* Amount Range */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Amount Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="min-amount" className="text-xs text-muted-foreground">
                          Minimum ($)
                        </Label>
                        <Input
                          id="min-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={advancedFilters.minAmount}
                          onChange={(e) => setAdvancedFilters({
                            ...advancedFilters,
                            minAmount: e.target.value
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="max-amount" className="text-xs text-muted-foreground">
                          Maximum ($)
                        </Label>
                        <Input
                          id="max-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="10000.00"
                          value={advancedFilters.maxAmount}
                          onChange={(e) => setAdvancedFilters({
                            ...advancedFilters,
                            maxAmount: e.target.value
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Status Filters */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Payment Status</Label>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="amount-due-only" className="text-sm font-normal">
                          Show only invoices with balance due
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Excludes fully paid invoices
                        </p>
                      </div>
                      <Switch
                        id="amount-due-only"
                        checked={advancedFilters.amountDueOnly}
                        onCheckedChange={(checked) =>
                          setAdvancedFilters({ ...advancedFilters, amountDueOnly: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="include-partial" className="text-sm font-normal">
                          Include partially paid invoices
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show invoices with partial payments
                        </p>
                      </div>
                      <Switch
                        id="include-partial"
                        checked={advancedFilters.includePartiallyPaid}
                        onCheckedChange={(checked) =>
                          setAdvancedFilters({ ...advancedFilters, includePartiallyPaid: checked })
                        }
                      />
                    </div>
                  </div>

                  {/* Quick Amount Presets */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Quick Filters</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdvancedFilters({
                          ...advancedFilters,
                          minAmount: '0',
                          maxAmount: '100'
                        })}
                      >
                        $0 - $100
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdvancedFilters({
                          ...advancedFilters,
                          minAmount: '100',
                          maxAmount: '1000'
                        })}
                      >
                        $100 - $1,000
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdvancedFilters({
                          ...advancedFilters,
                          minAmount: '1000',
                          maxAmount: '10000'
                        })}
                      >
                        $1,000 - $10,000
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdvancedFilters({
                          ...advancedFilters,
                          minAmount: '10000',
                          maxAmount: ''
                        })}
                      >
                        $10,000+
                      </Button>
                    </div>
                  </div>

                  {/* Clear Advanced Filters */}
                  {(advancedFilters.minAmount || advancedFilters.maxAmount || advancedFilters.amountDueOnly || advancedFilters.customerIds.length > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAdvancedFilters({
                        minAmount: '',
                        maxAmount: '',
                        amountDueOnly: false,
                        includePartiallyPaid: true,
                        customerIds: []
                      })}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Advanced Filters
                    </Button>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Desktop & Tablet Table View */}
          <Card className="border-0 shadow-sm hidden sm:block">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>All Invoices</CardTitle>
                <CardDescription>
                  {totalCount} invoice{totalCount !== 1 ? 's' : ''} found
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
                        checked={selectedInvoices.length === invoices.length && invoices.length > 0}
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
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No invoices found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((invoice) => (
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
                          {invoice.invoice_date ? format(parseISO(invoice.invoice_date + 'T00:00:00'), 'MMM d, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {invoice.due_date ? format(parseISO(invoice.due_date + 'T00:00:00'), 'MMM d, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${invoice.total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={getStatusVariant(invoice.status, invoice.amount_due || 0).variant}
                            className={getStatusVariant(invoice.status, invoice.amount_due || 0).className}
                          >
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
                {totalCount} invoice{totalCount !== 1 ? 's' : ''}
              </p>
            </div>
            
            {invoices.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No invoices found</p>
                </CardContent>
              </Card>
            ) : (
              invoices.map((invoice) => (
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
                            variant={getStatusVariant(invoice.status, invoice.amount_due || 0).variant}
                            className={`${getStatusVariant(invoice.status, invoice.amount_due || 0).className} shrink-0`}
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
                          {invoice.invoice_date ? format(parseISO(invoice.invoice_date + 'T00:00:00'), 'MMM d, yyyy') : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="block">Due Date</span>
                        <span className="font-medium text-foreground">
                          {invoice.due_date ? format(parseISO(invoice.due_date + 'T00:00:00'), 'MMM d, yyyy') : 'N/A'}
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
                    value={String(itemsPerPage)} 
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">
                    {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
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