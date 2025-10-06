import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SalesOrdersList } from "@/components/SalesOrdersList"
import { CustomerTemplates } from "@/components/CustomerTemplates"


export default function SalesOrders() {


  return (
    <div className="space-y-6">
      {/* Header with Bundui styling */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Orders</h1>
          <p className="text-muted-foreground mt-1">View and manage sales orders generated from customer templates</p>
        </div>
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="orders">
            Sales Orders
          </TabsTrigger>
          <TabsTrigger value="templates">
            Customer Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6">
          <SalesOrdersList />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <CustomerTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}