import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Copy, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { CustomerTemplateDialog } from "@/components/CustomerTemplateDialog";

interface CustomerTemplate {
  id: string;
  customer_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  customer_profile?: {
    company_name: string;
  };
}

interface Customer {
  id: string;
  company_name: string;
}

export function CustomerTemplates() {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomerTemplate | null>(null);
  const { toast } = useToast();

  // Fetch customers for filter
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profile')
        .select('id, company_name')
        .order('company_name');
      
      if (error) throw error;
      return data as Customer[];
    }
  });

  // Fetch customer templates from database
  const { data: templates, isLoading, refetch } = useQuery<CustomerTemplate[]>({
    queryKey: ['customer-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching templates:', error);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Fetch customer info separately
      const customerIds = [...new Set(data.map(t => t.customer_id))];
      const { data: customerData, error: customerError } = await supabase
        .from('customer_profile')
        .select('id, company_name')
        .in('id', customerIds);

      if (customerError) {
        console.error('Error fetching customer data:', customerError);
        return data.map(template => ({ ...template, customer_profile: undefined }));
      }

      // Combine the data
      return data.map(template => {
        const customer = customerData.find(c => c.id === template.customer_id);
        return {
          ...template,
          customer_profile: customer ? { company_name: customer.company_name } : undefined
        };
      });
    }
  });

  const handleEdit = (template: CustomerTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('customer_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
      refetch();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    }
  };

  const handleDuplicate = async (template: CustomerTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.user_metadata?.organization_id) return;

      const { error } = await supabase
        .from('customer_templates')
        .insert({
          customer_id: template.customer_id,
          name: `${template.name} (Copy)`,
          description: template.description,
          is_active: false,
          organization_id: user.user_metadata.organization_id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template duplicated successfully",
      });
      refetch();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast({
        title: "Error",
        description: "Failed to duplicate template",
        variant: "destructive",
      });
    }
  };

  const filteredTemplates = (templates || []).filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.customer_profile?.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="content-section">
      <Card className="card-data-table">
        <CardHeader className="table-header-enhanced">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Customer Templates</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Create and manage ordering templates for your customers (Batchly-only feature)
              </CardDescription>
            </div>
            <Button 
              onClick={() => {
                setEditingTemplate(null);
                setDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10"
              />
            </div>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="w-full sm:w-[200px] h-10">
                <SelectValue placeholder="Filter by customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                          <FileText className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-medium text-foreground">No templates found</h3>
                          <p className="text-sm text-muted-foreground">Create your first template to get started</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>{template.customer_profile?.company_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {template.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.is_active ? "default" : "secondary"}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(template.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(template)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CustomerTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        onSuccess={() => {
          setDialogOpen(false);
          setEditingTemplate(null);
          refetch(); // Refresh the templates list
        }}
      />
    </div>
  );
}