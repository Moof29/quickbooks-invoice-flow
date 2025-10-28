import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { CustomerTemplates } from "@/components/CustomerTemplates";
import { GenerateDailyOrdersButton } from "@/components/GenerateDailyOrdersButton";
import { GenerateTemplateTestDataButton } from "@/components/GenerateTemplateTestDataButton";
import { BatchJobStatusBar } from "@/components/BatchJobStatusBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { Invoice, InvoiceStatus, InvoiceStatusLabels, InvoiceStatusColors } from "@/types/invoice";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SalesOrders() {
  const navigate = useNavigate();
  const { organization, user } = useAuthProfile();
  const queryClient = useQueryClient();
  
  const [selectedStatus, setSelectedStatus] = useState<'draft' | 'pending' | 'approved' | 'invoiced' | 'cancelled' | 'all' | 'templates'>('draft');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Fetch invoices (unified orders/invoices)
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', organization?.id, selectedStatus],
    queryFn: async () => {
      if (!organization?.id || selectedStatus === 'templates' || selectedStatus === 'all') {
        if (selectedStatus === 'templates') return [];
        if (!organization?.id) return [];
      }
      
      let query = supabase
        .from('invoice_record')
        .select(`
          *,
          customer_profile:customer_id(display_name, company_name, email)
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (!['all', 'templates'].includes(selectedStatus)) {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id && selectedStatus !== 'templates',
  });

  // Bulk status update mutation using RPC
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ invoiceIds, newStatus }: { invoiceIds: string[], newStatus: string }) => {
      // Use the bulk update RPC function for better performance
      const { data, error } = await supabase.rpc('bulk_update_invoice_status', {
        p_invoice_ids: invoiceIds,
        p_new_status: newStatus,
        p_updated_by: user?.id
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const updatedCount = data?.updated_count || 0;
      const failedCount = data?.failed_count || 0;
      
      toast.success(`Updated ${updatedCount} invoice(s) successfully`);
      
      if (failedCount > 0) {
        toast.error(`Failed to update ${failedCount} invoice(s)`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast.error('Failed to update invoices: ' + error.message);
    }
  });

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) {
      toast.error('Please select orders to approve');
      return;
    }
    bulkUpdateMutation.mutate({ invoiceIds: selectedIds, newStatus: 'approved' });
  };

  const handleClearAllOrders = async () => {
    setIsClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('clear-invoices');
      
      if (error) throw error;
      
      toast.success(
        `Clearing started: ${data.deleted.invoices} invoices, ${data.deleted.line_items} line items. Refreshing...`
      );
      
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      
      setIsClearDialogOpen(false);
      
      // Wait 2 seconds before refreshing to allow background process
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      toast.error(`Failed to clear orders: ${error.message}`);
      console.error('Clear orders error:', error);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <BatchJobStatusBar />
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Orders</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Create and manage sales orders
            </p>
          </div>
          
          {/* Desktop Actions */}
          <div className="hidden md:flex gap-2">
            <GenerateTemplateTestDataButton />
            <GenerateDailyOrdersButton />
            <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="lg">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Orders?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all orders and invoices. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearAllOrders}
                    disabled={isClearing}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isClearing ? "Clearing..." : "Clear All"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={() => navigate('/orders/new')} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </div>
          
          {/* Mobile Actions */}
          <div className="flex md:hidden gap-2">
            <GenerateDailyOrdersButton />
          </div>
        </div>

        <Tabs value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-7 lg:max-w-4xl">
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="invoiced">Invoiced</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedStatus} className="mt-4 md:mt-6 space-y-4">
            {selectedStatus !== 'templates' && (
              <>
                {/* Bulk Actions Bar */}
                {selectedIds.length > 0 && (
                  <Card className="p-4 bg-primary/5 border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{selectedIds.length} selected</span>
                      <div className="flex gap-2">
                        {selectedStatus === 'draft' && (
                          <Button 
                            onClick={handleBulkApprove} 
                            size="sm"
                            disabled={bulkUpdateMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve ({selectedIds.length})
                          </Button>
                        )}
                        <Button 
                          onClick={() => setSelectedIds([])} 
                          variant="outline" 
                          size="sm"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Invoice List */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center space-y-2">
                      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  </div>
                ) : invoices && invoices.length > 0 ? (
                  <div className="space-y-2">
                    {invoices.map((invoice) => (
                      <Card
                        key={invoice.id}
                        className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('[data-checkbox]')) return;
                          navigate(`/invoices/${invoice.id}`);
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div data-checkbox onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.includes(invoice.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedIds([...selectedIds, invoice.id]);
                                } else {
                                  setSelectedIds(selectedIds.filter(id => id !== invoice.id));
                                }
                              }}
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-lg">
                                {invoice.customer_profile?.company_name || invoice.customer_profile?.display_name || 'Unknown Customer'}
                              </span>
                              <Badge className={InvoiceStatusColors[invoice.status]}>
                                {InvoiceStatusLabels[invoice.status]}
                              </Badge>
                              {invoice.is_no_order && (
                                <Badge variant="outline" className="bg-gray-100">NO ORDER</Badge>
                              )}
                            </div>
                            <div className="text-sm mt-1 space-x-2">
                              <span className="font-medium">
                                Delivery: {invoice.delivery_date ? format(new Date(invoice.delivery_date), 'EEE, MMM dd, yyyy') : 'N/A'}
                              </span>
                              <span className="text-muted-foreground">• {invoice.invoice_number}</span>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="font-semibold">${invoice.total?.toFixed(2) || '0.00'}</div>
                            {invoice.status === 'partial' && (
                              <div className="text-xs text-muted-foreground">
                                Paid: ${invoice.amount_paid?.toFixed(2) || '0.00'}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12">
                    <div className="text-center space-y-2">
                      <p className="text-muted-foreground">
                        No {['all', 'templates'].includes(selectedStatus) ? '' : (InvoiceStatusLabels as any)[selectedStatus]?.toLowerCase() || ''} orders found
                      </p>
                      <Button onClick={() => navigate('/orders/new')} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Order
                      </Button>
                    </div>
                  </Card>
                )}
              </>
            )}
            
            {selectedStatus === 'templates' && (
              <CustomerTemplates />
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Mobile FAB */}
      <Button
        onClick={() => navigate('/orders/new')}
        size="lg"
        className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform"
        aria-label="New Order"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </>
  );
}