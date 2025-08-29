import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerTemplates } from "@/components/CustomerTemplates";
import { SalesOrdersList } from "@/components/SalesOrdersList";
import { ModernPageHeader } from "@/components/ModernPageHeader";

export default function SalesOrders() {
  return (
    <div className="min-h-screen bg-background">
      <ModernPageHeader
        title="Sales Orders"
        description="Manage sales orders and customer templates"
      />

      <div className="p-6">
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="orders">Sales Orders</TabsTrigger>
            <TabsTrigger value="templates">Customer Templates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="templates" className="mt-6">
            <CustomerTemplates />
          </TabsContent>
          
          <TabsContent value="orders" className="mt-6">
            <SalesOrdersList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}