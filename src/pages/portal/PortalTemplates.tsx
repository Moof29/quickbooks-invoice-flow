import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edit, FileText, LogOut, ArrowLeft, Building2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';
import { usePortalAuth } from "@/hooks/usePortalAuth";
import { PortalTemplateDialog } from "@/components/PortalTemplateDialog";

interface CustomerTemplate {
  id: string;
  customer_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export default function PortalTemplates() {
  const { customerLink, customerProfile, loading: authLoading, signOut } = usePortalAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomerTemplate | null>(null);

  useEffect(() => {
    if (!customerProfile && !authLoading) {
      const impersonationToken = sessionStorage.getItem('portal_impersonation_token');
      if (!impersonationToken) {
        navigate('/portal/login');
      }
    }
  }, [authLoading, customerProfile, navigate]);

  // Fetch customer templates
  const { data: templates, isLoading, refetch } = useQuery<CustomerTemplate[]>({
    queryKey: ['portal-customer-templates', customerLink?.customer_id],
    enabled: !!customerLink?.customer_id,
    queryFn: async () => {
      if (!customerLink?.customer_id) return [];
      
      const { data, error } = await supabase
        .from('customer_templates')
        .select('*')
        .eq('customer_id', customerLink.customer_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CustomerTemplate[];
    }
  });

  const handleEdit = (template: CustomerTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleSignOut = async () => {
    const impersonationToken = sessionStorage.getItem('portal_impersonation_token');
    
    if (impersonationToken) {
      sessionStorage.removeItem('portal_impersonation_token');
      window.close();
    } else {
      await signOut();
      navigate('/portal/login');
    }
  };

  // Demo data for when not logged in
  if (!customerLink || !customerProfile) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Demo Customer Portal</h1>
              <span className="text-sm text-muted-foreground">Demo User</span>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>My Order Templates</CardTitle>
              <CardDescription>
                Manage your recurring order templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="flex flex-col items-center space-y-3">
                  <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium text-foreground">Demo Mode</h3>
                    <p className="text-sm text-muted-foreground">
                      Login to view your order templates
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{customerProfile.company_name}</h1>
              <p className="text-sm text-muted-foreground">Customer Portal</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/portal/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h2 className="text-3xl font-bold tracking-tight mt-4">My Order Templates</h2>
            <p className="text-muted-foreground">Manage your recurring order templates. You can adjust quantities and add/remove items.</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>My Order Templates</CardTitle>
            <CardDescription>
              Manage your recurring order templates. You can adjust quantities and add/remove items.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading templates...</p>
              </div>
            ) : templates && templates.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <div className="flex flex-col items-center space-y-3">
                  <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium text-foreground">No templates found</h3>
                    <p className="text-sm text-muted-foreground">
                      Contact your supplier to set up order templates
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <PortalTemplateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          template={editingTemplate}
          customerId={customerLink.customer_id}
          onSuccess={() => {
            setDialogOpen(false);
            setEditingTemplate(null);
            refetch();
          }}
        />
      </main>
    </div>
  );
}
