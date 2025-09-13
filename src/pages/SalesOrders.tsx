import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { SalesOrdersList } from "@/components/SalesOrdersList"
import { CustomerTemplates } from "@/components/CustomerTemplates"
import { GenerateTestDataButton } from "@/components/GenerateTestDataButton"
import { CreateSalesOrderDialog } from "@/components/CreateSalesOrderDialog"


export default function SalesOrders() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)


  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header with sharp, minimal styling */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Sales Orders</h1>
            <p className="mt-1 text-sm text-muted-foreground">View and manage sales orders generated from customer templates</p>
          </div>
          <div className="flex space-x-3">
            <GenerateTestDataButton />
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              Create Sales Order
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="orders" className="w-full">
          {/* Clean tab design */}
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted mb-8">
            <TabsTrigger value="orders" className="data-[state=active]:bg-background data-[state=active]:text-foreground">
              Sales Orders
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-background data-[state=active]:text-foreground">
              Customer Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-8">
            {/* Sales Orders List - preserving original functionality */}
            <SalesOrdersList />
          </TabsContent>
          
          <TabsContent value="templates" className="mt-8">
            <CustomerTemplates />
          </TabsContent>
        </Tabs>
      </div>

      <CreateSalesOrderDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}