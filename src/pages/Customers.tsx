
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  Mail,
  Phone,
  Building2,
  MoreHorizontal,
  MapPin
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CustomerDialog } from '@/components/CustomerDialog';
import { ModernPageHeader } from '@/components/ModernPageHeader';

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
}

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCustomers();
  }, [searchTerm]);

  const loadCustomers = async () => {
    try {
      let query = supabase
        .from('customer_profile')
        .select('id, display_name, company_name, email, phone, billing_city, billing_state, created_at, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`display_name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Customers</h2>
          <p className="text-muted-foreground">
            Manage your customer relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search customers by name, company, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-80"
            />
          </div>
          <Button onClick={() => setShowCustomerDialog(true)} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {customers.map((customer) => (
          <Card key={customer.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-12 w-12 bg-gradient-to-br from-primary/20 to-primary/30 rounded-lg flex items-center justify-center ring-1 ring-primary/20 shrink-0">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-lg truncate" title={customer.company_name}>
                      {customer.company_name}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate" title={customer.display_name}>
                      {customer.display_name}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-muted-foreground min-w-0">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1" title={customer.email}>
                    {customer.email}
                  </span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.billing_city && customer.billing_state && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground min-w-0">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1" title={`${customer.billing_city}, ${customer.billing_state}`}>
                      {customer.billing_city}, {customer.billing_state}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="text-xs text-muted-foreground">
                    Created {format(new Date(customer.created_at), 'MMM dd, yyyy')}
                  </div>
                  <Badge variant={customer.is_active ? "default" : "secondary"} className="text-xs shrink-0">
                    {customer.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {customers.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="text-center py-16">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                <svg className="h-8 w-8 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No customers found</h3>
            <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
              {searchTerm ? 'Try adjusting your search criteria to find what you\'re looking for' : 'Get started by adding your first customer to manage relationships'}
            </p>
            <Button onClick={() => setShowCustomerDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </CardContent>
        </Card>
      )}

      <CustomerDialog 
        open={showCustomerDialog} 
        onOpenChange={setShowCustomerDialog}
        onSuccess={loadCustomers}
      />
    </div>
  );
};

export default Customers;
