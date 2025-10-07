import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ModernSalesOrdersList } from "@/components/ModernSalesOrdersList";
import { CustomerTemplates } from "@/components/CustomerTemplates";
import { CreateSalesOrderDialog } from "@/components/CreateSalesOrderDialog";
import { GenerateDailyOrdersButton } from "@/components/GenerateDailyOrdersButton";
import { GenerateTemplateTestDataButton } from "@/components/GenerateTemplateTestDataButton";

export default function SalesOrders() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Orders</h1>
          <p className="text-muted-foreground mt-1">
            Manage daily orders for next-day delivery
          </p>
        </div>
        <div className="flex gap-2">
          <GenerateTemplateTestDataButton />
          <GenerateDailyOrdersButton />
          <Button onClick={() => setIsCreateDialogOpen(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="orders">Sales Orders</TabsTrigger>
          <TabsTrigger value="templates">Customer Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6">
          <ModernSalesOrdersList />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <CustomerTemplates />
        </TabsContent>
      </Tabs>

      <CreateSalesOrderDialog 
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}