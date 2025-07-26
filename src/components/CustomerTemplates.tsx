import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Copy } from 'lucide-react';
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

export function CustomerTemplates() {
  const [templates, setTemplates] = useState<CustomerTemplate[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomerTemplate | null>(null);
  const { toast } = useToast();

  // Fetch customers for filter
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profile')
        .select('id, company_name')
        .order('company_name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch templates
  const fetchTemplates = async () => {
    let query = supabase
      .from('customer_templates')
      .select(`
        *,
        customer_profile:customer_id (
          company_name
        )
      `)
      .order('created_at', { ascending: false });

    if (selectedCustomer !== 'all') {
      query = query.eq('customer_id', selectedCustomer);
    }

    const { data, error } = await query;
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch customer templates",
        variant: "destructive",
      });
      return;
    }

    setTemplates(data || []);
  };

  useEffect(() => {
    fetchTemplates();
  }, [selectedCustomer]);

  const handleEdit = (template: CustomerTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = async (templateId: string) => {
    const { error } = await supabase
      .from('customer_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Template deleted successfully",
    });
    
    fetchTemplates();
  };

  const handleDuplicate = async (template: CustomerTemplate) => {
    const { error } = await supabase
      .from('customer_templates')
      .insert({
        customer_id: template.customer_id,
        name: `${template.name} (Copy)`,
        description: template.description,
        is_active: false
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate template",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Template duplicated successfully",
    });
    
    fetchTemplates();
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.customer_profile?.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer Templates</CardTitle>
              <CardDescription>
                Create and manage ordering templates for your customers
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
        
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="w-[200px]">
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

          <div className="rounded-md border">
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No templates found. Create your first template to get started.
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
          fetchTemplates();
          setDialogOpen(false);
          setEditingTemplate(null);
        }}
      />
    </div>
  );
}