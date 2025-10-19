import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { ModernSalesOrdersList } from "@/components/ModernSalesOrdersList";
import { CustomerTemplates } from "@/components/CustomerTemplates";
import { GenerateDailyOrdersButton } from "@/components/GenerateDailyOrdersButton";
import { GenerateTemplateTestDataButton } from "@/components/GenerateTemplateTestDataButton";
import { BatchJobStatusBar } from "@/components/BatchJobStatusBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const queryClient = useQueryClient();

  const handleClearAllOrders = async () => {
    setIsClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('clear-sales-orders');
      
      if (error) throw error;
      
      toast.success(
        `Cleared ${data.deleted.sales_orders} sales orders, ${data.deleted.line_items} line items, and ${data.deleted.invoice_links} invoice links`
      );
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order'] });
      
      setIsClearDialogOpen(false);
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
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sales Orders</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Manage daily orders for next-day delivery
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
                  Clear All Orders
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Sales Orders?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all sales orders, line items, and invoice links for your organization. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearAllOrders}
                    disabled={isClearing}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isClearing ? "Clearing..." : "Clear All Orders"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={() => navigate('/sales-orders/new')} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </div>
          
          {/* Mobile: Only show most important actions */}
          <div className="flex md:hidden gap-2">
            <GenerateDailyOrdersButton />
          </div>
        </div>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="orders">Sales Orders</TabsTrigger>
            <TabsTrigger value="templates">Customer Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-4 md:mt-6">
            <ModernSalesOrdersList />
          </TabsContent>

          <TabsContent value="templates" className="mt-4 md:mt-6">
            <CustomerTemplates />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Mobile FAB for New Order */}
      <Button
        onClick={() => navigate('/sales-orders/new')}
        size="lg"
        className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform touch-manipulation"
        aria-label="New Order"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </>
  );
}