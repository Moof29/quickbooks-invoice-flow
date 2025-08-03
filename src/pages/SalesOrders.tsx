import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerTemplates } from "@/components/CustomerTemplates";
import { SalesOrdersList } from "@/components/SalesOrdersList";

export default function SalesOrders() {
  return (
    <div className="container mx-auto p-6 md:p-8 lg:p-10 animate-fade-in">
      <div className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3">Sales Orders</h1>
        <p className="text-lg md:text-xl text-muted-foreground">Manage sales orders and customer templates with enterprise-grade tools</p>
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[600px] h-16 md:h-18 bg-muted/50 p-2 rounded-2xl shadow-lg">
          <TabsTrigger 
            value="orders" 
            className="text-lg md:text-xl font-semibold touch-target rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-200"
          >
            Sales Orders
          </TabsTrigger>
          <TabsTrigger 
            value="templates" 
            className="text-lg md:text-xl font-semibold touch-target rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-200"
          >
            Customer Templates
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="templates" className="mt-8 md:mt-10 animate-slide-up">
          <CustomerTemplates />
        </TabsContent>
        
        <TabsContent value="orders" className="mt-8 md:mt-10 animate-slide-up">
          <SalesOrdersList />
        </TabsContent>
      </Tabs>
    </div>
  );
}