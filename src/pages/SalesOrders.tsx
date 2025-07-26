import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerTemplates } from "@/components/CustomerTemplates";

export default function SalesOrders() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Sales Orders</h1>
        <p className="text-muted-foreground">Manage sales orders and customer templates</p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="templates">Customer Templates</TabsTrigger>
          <TabsTrigger value="orders">Sales Orders</TabsTrigger>
        </TabsList>
        
        <TabsContent value="templates" className="mt-6">
          <CustomerTemplates />
        </TabsContent>
        
        <TabsContent value="orders" className="mt-6">
          <div className="text-center text-muted-foreground">
            Sales Orders functionality coming soon...
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}