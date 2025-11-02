import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  TrendingUp,
  Users,
  DollarSign,
  ShoppingBag,
  UserCircle,
  Shield,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CustomerDialog } from '@/components/CustomerDialog';
import { CustomerPortalUsersDialog } from '@/components/CustomerPortalUsersDialog';
import { CustomerTemplateDialog } from '@/components/CustomerTemplateDialog';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { MobileFAB } from '@/components/MobileFAB';
import { useIsMobile } from '@/hooks/use-mobile';

interface Customer {
  id: string;
  display_name: string;
  company_name: string;
  email: string;
  phone: string;
  billing_city: string;
  billing_state: string;
  created_at: string;
  address?: string;
  is_active: boolean;
  portal_enabled: boolean;
  portal_invitation_sent_at: string | null;
}

const Customers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showPortalUsersDialog, setShowPortalUsersDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedCustomerForPortal, setSelectedCustomerForPortal] = useState<{ id: string; name: string } | null>(null);
  const [selectedCustomerForTemplate, setSelectedCustomerForTemplate] = useState<{ id: string; name: string } | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch total count for pagination
  const { data: totalCount = 0 } = useQuery<number>({
    queryKey: ['customers-count', debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from('customer_profile')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (debouncedSearch) {
        query = query.or(`display_name.ilike.%${debouncedSearch}%,company_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }
  });

  // Fetch paginated customers
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', currentPage, debouncedSearch],
    queryFn: async () => {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('customer_profile')
        .select('id, display_name, company_name, email, phone, billing_city, billing_state, created_at, is_active, portal_enabled, portal_invitation_sent_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (debouncedSearch) {
        query = query.or(`display_name.ilike.%${debouncedSearch}%,company_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  const loadCustomers = () => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['customers-count'] });
  };

  const handleTogglePortalAccess = async (customerId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('customer_profile')
        .update({ 
          portal_enabled: newStatus,
          portal_invitation_sent_at: newStatus ? new Date().toISOString() : null
        })
        .eq('id', customerId);

      if (error) throw error;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['customers'] });

      toast({
        title: "Success",
        description: `Portal access ${newStatus ? 'enabled' : 'disabled'} for customer`,
      });
    } catch (error) {
      console.error('Error toggling portal access:', error);
      toast({
        title: "Error",
        description: "Failed to update portal access",
        variant: "destructive",
      });
    }
  };

  const handleImpersonateCustomer = async (customerId: string) => {
    try {
      // Create secure impersonation token via edge function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'create-impersonation-token',
        { body: { customerId } }
      );

      if (tokenError || !tokenData?.token) {
        throw new Error(tokenError?.message || 'Failed to create impersonation token');
      }

      // Store secure token in sessionStorage
      sessionStorage.setItem('portal_impersonation_token', tokenData.token);

      // Navigate to portal dashboard
      window.open('/portal/dashboard', '_blank');

      toast({
        title: "Portal View",
        description: "Opening customer portal in new tab",
      });
    } catch (error: any) {
      console.error('Error impersonating customer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to access customer portal",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const { error } = await supabase
        .from('customer_profile')
        .update({ is_active: false })
        .eq('id', customerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });

      loadCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive",
      });
    }
  };

  const toggleCustomer = (id: string) => {
    setSelectedCustomers(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedCustomers(prev =>
      prev.length === customers.length ? [] : customers.map(c => c.id)
    );
  };

  const activeCustomers = totalCount;
  const totalRevenue = 0; // Placeholder - can be calculated from orders if needed
  const avgOrderValue = 0; // Placeholder - can be calculated from orders if needed
  const topCustomers = 0; // Placeholder - can be calculated from orders if needed

  if (isLoading && customers.length === 0) {
    return (
      <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-6 lg:p-8">
        <div className="animate-pulse space-y-4 md:space-y-6">
          <div className="h-24 md:h-32 bg-muted rounded-lg"></div>
          <div className="h-64 md:h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  const totalCustomers = totalCount;

  return (
    <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Customers</h2>
          <p className="text-sm md:text-base text-muted-foreground">Manage your customer relationships</p>
        </div>
        <Button onClick={() => setShowCustomerDialog(true)} className="hidden md:flex">
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Total Customers</p>
                <p className="text-lg md:text-2xl font-bold">{totalCustomers}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs md:text-sm">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">+12%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-lg md:text-2xl font-bold">{activeCustomers}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs md:text-sm">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">+8%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-lg md:text-2xl font-bold">$45,230</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs md:text-sm">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">+23%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Avg Order Value</p>
                <p className="text-lg md:text-2xl font-bold">$2,350</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs md:text-sm">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">+5%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-10 md:h-auto"
        />
      </div>

      {/* Desktop Table View */}
      <Card className="border-0 shadow-sm hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedCustomers.length === customers.length && customers.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Portal Access</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedCustomers.includes(customer.id)}
                      onCheckedChange={() => toggleCustomer(customer.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(customer.company_name || customer.display_name || 'CU').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{customer.company_name || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">{customer.display_name || 'N/A'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{customer.email}</TableCell>
                  <TableCell className="text-sm">{customer.phone || '-'}</TableCell>
                  <TableCell className="text-sm">
                    {customer.billing_city && customer.billing_state
                      ? `${customer.billing_city}, ${customer.billing_state}`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.is_active ? "default" : "secondary"} className="bg-green-100 text-green-800">
                      {customer.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={customer.portal_enabled}
                        onCheckedChange={() => handleTogglePortalAccess(customer.id, customer.portal_enabled)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {customer.portal_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedCustomerForTemplate({
                              id: customer.id,
                              name: customer.company_name || customer.display_name
                            });
                            setShowTemplateDialog(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Manage Templates
                        </DropdownMenuItem>
                        {customer.portal_enabled && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedCustomerForPortal({
                                  id: customer.id,
                                  name: customer.company_name || customer.display_name
                                });
                                setShowPortalUsersDialog(true);
                              }}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Manage Portal Users
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleImpersonateCustomer(customer.id)}>
                              <UserCircle className="h-4 w-4 mr-2" />
                              View as Customer
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteCustomer(customer.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {customers.length === 0 && (
            <div className="text-center py-16">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No customers found</h3>
              <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
                {searchTerm
                  ? 'Try adjusting your search criteria'
                  : 'Get started by adding your first customer'}
              </p>
              <Button onClick={() => setShowCustomerDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} customers
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {customers.map((customer) => (
          <Card key={customer.id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedCustomers.includes(customer.id)}
                  onCheckedChange={() => toggleCustomer(customer.id)}
                  className="mt-1"
                />
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {(customer.company_name || customer.display_name || 'CU').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{customer.company_name || 'N/A'}</h3>
                      <p className="text-xs text-muted-foreground truncate">{customer.display_name || 'N/A'}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedCustomerForTemplate({
                              id: customer.id,
                              name: customer.company_name || customer.display_name
                            });
                            setShowTemplateDialog(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Manage Templates
                        </DropdownMenuItem>
                        {customer.portal_enabled && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedCustomerForPortal({
                                  id: customer.id,
                                  name: customer.company_name || customer.display_name
                                });
                                setShowPortalUsersDialog(true);
                              }}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Manage Portal Users
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleImpersonateCustomer(customer.id)}>
                              <UserCircle className="h-4 w-4 mr-2" />
                              View as Customer
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteCustomer(customer.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="space-y-1 text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="truncate">{customer.email}</span>
                    </div>
                    {customer.phone && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Phone:</span>
                        <span>{customer.phone}</span>
                      </div>
                    )}
                    {(customer.billing_city && customer.billing_state) && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Location:</span>
                        <span>{customer.billing_city}, {customer.billing_state}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Badge variant={customer.is_active ? "default" : "secondary"} className="bg-green-100 text-green-800 text-xs">
                      {customer.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={customer.portal_enabled}
                        onCheckedChange={() => handleTogglePortalAccess(customer.id, customer.portal_enabled)}
                      />
                      <span className="text-xs text-muted-foreground">
                        Portal
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {customers.length === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No customers found</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  {searchTerm
                    ? 'Try adjusting your search criteria'
                    : 'Get started by adding your first customer'}
                </p>
                <Button onClick={() => setShowCustomerDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} customers
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <MobileFAB onClick={() => setShowCustomerDialog(true)} label="Add Customer" />

      <CustomerDialog 
        open={showCustomerDialog} 
        onOpenChange={setShowCustomerDialog}
        onSuccess={loadCustomers}
      />

      {selectedCustomerForPortal && (
        <CustomerPortalUsersDialog
          open={showPortalUsersDialog}
          onOpenChange={setShowPortalUsersDialog}
          customerId={selectedCustomerForPortal.id}
          customerName={selectedCustomerForPortal.name}
        />
      )}

      <CustomerTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        template={null}
        onSuccess={() => {
          setShowTemplateDialog(false);
          setSelectedCustomerForTemplate(null);
          loadCustomers();
        }}
      />
    </div>
  );
};

export default Customers;
