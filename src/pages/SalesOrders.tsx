import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerTemplates } from "@/components/CustomerTemplates";
import { SalesOrdersList } from "@/components/SalesOrdersList";
import { ModernPageHeader } from "@/components/ModernPageHeader";

export default function SalesOrders() {
  return (
    <div className="page-container">
      <ModernPageHeader
        title="Sales Orders"
        description="Manage sales orders and customer templates"
      />

      <div className="page-content">
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px] btn-text">
            <TabsTrigger value="orders" className="nav-item">Sales Orders</TabsTrigger>
            <TabsTrigger value="templates" className="nav-item">Customer Templates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="templates" className="mt-8">
            <CustomerTemplates />
          </TabsContent>
          
          <TabsContent value="orders" className="mt-8">
            <SalesOrdersList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}