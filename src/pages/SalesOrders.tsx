import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerTemplates } from "@/components/CustomerTemplates";
import { SalesOrdersList } from "@/components/SalesOrdersList";

export default function SalesOrders() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">Sales Orders</h1>
        <p className="text-base md:text-lg text-muted-foreground mt-2">Manage sales orders and customer templates</p>
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[500px] h-12 md:h-14">
          <TabsTrigger value="orders" className="text-base md:text-lg touch-target">Sales Orders</TabsTrigger>
          <TabsTrigger value="templates" className="text-base md:text-lg touch-target">Customer Templates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="templates" className="mt-6 md:mt-8">
          <CustomerTemplates />
        </TabsContent>
        
        <TabsContent value="orders" className="mt-6 md:mt-8">
          <SalesOrdersList />
        </TabsContent>
      </Tabs>
    </div>
  );
}