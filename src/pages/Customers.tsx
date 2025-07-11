
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  Mail,
  Phone
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CustomerDialog } from '@/components/CustomerDialog';

interface Customer {
  id: string;
  display_name: string;
  company_name: string;
  email: string;
  phone: string;
  billing_city: string;
  billing_state: string;
  created_at: string;
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
        .select('id, display_name, company_name, email, phone, billing_city, billing_state, created_at')
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
              <p className="text-gray-600 mt-1">Manage your customer relationships</p>
            </div>
            <Button onClick={() => setShowCustomerDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search customers by name, company, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customers List */}
        <Card>
          <CardHeader>
            <CardTitle>All Customers</CardTitle>
            <CardDescription>
              {customers.length} customer{customers.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {customers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first customer'}
                </p>
                <Button onClick={() => setShowCustomerDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customers.map((customer) => (
                  <Card key={customer.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{customer.display_name}</CardTitle>
                          {customer.company_name && (
                            <CardDescription className="text-sm font-medium text-blue-600">
                              {customer.company_name}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="ghost" size="sm" title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Delete"
                            onClick={() => handleDeleteCustomer(customer.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {customer.email && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="h-4 w-4 mr-2" />
                            <a href={`mailto:${customer.email}`} className="hover:text-blue-600">
                              {customer.email}
                            </a>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-4 w-4 mr-2" />
                            <a href={`tel:${customer.phone}`} className="hover:text-blue-600">
                              {customer.phone}
                            </a>
                          </div>
                        )}
                        {(customer.billing_city || customer.billing_state) && (
                          <div className="flex items-center text-sm text-gray-600">
                            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {[customer.billing_city, customer.billing_state].filter(Boolean).join(', ')}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Added {new Date(customer.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CustomerDialog 
        open={showCustomerDialog} 
        onOpenChange={setShowCustomerDialog}
        onSuccess={loadCustomers}
      />
    </div>
  );
};

export default Customers;
