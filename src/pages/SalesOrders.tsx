import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, BarChart } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { SalesOrdersList } from "@/components/SalesOrdersList"
import { CustomerTemplates } from "@/components/CustomerTemplates"
import { GenerateTestDataButton } from "@/components/GenerateTestDataButton"
import { CreateSalesOrderDialog } from "@/components/CreateSalesOrderDialog"

// Sample data for charts - matching original functionality
const salesOverTimeData = [
  { name: "Jan", orders: 15 },
  { name: "Feb", orders: 25 },
  { name: "Mar", orders: 32 },
  { name: "Apr", orders: 40 },
  { name: "May", orders: 55 },
  { name: "Jun", orders: 48 },
  { name: "Jul", orders: 65 },
  { name: "Aug", orders: 70 },
]

const regionData = [
  { name: "North America", value: 400 },
  { name: "Europe", value: 300 },
  { name: "Asia", value: 300 },
  { name: "South America", value: 200 },
]

const PIE_CHART_COLORS = ["#000000", "#404040", "#737373", "#a3a3a3"]

export default function SalesOrders() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)


  return (
    <div className="min-h-screen bg-gray-50/30">
      {/* Header with sharp, minimal styling */}
      <div className="border-b bg-white">
        <div className="flex items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Sales Orders</h1>
            <p className="mt-1 text-sm text-gray-600">View and manage sales orders generated from customer templates</p>
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
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-gray-100 mb-8">
            <TabsTrigger value="orders" className="data-[state=active]:bg-white data-[state=active]:text-gray-900">
              Sales Orders
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-white data-[state=active]:text-gray-900">
              Customer Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-8">
            {/* Analytics Charts with clean styling */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-gray-200 bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
                    <TrendingUp className="h-4 w-4 text-gray-600" />
                    Sales Orders Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesOverTimeData}>
                        <XAxis dataKey="name" stroke="#6b7280" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis stroke="#6b7280" tickLine={false} axisLine={false} fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="orders"
                          stroke="#000000"
                          strokeWidth={2}
                          dot={{ fill: "#000000", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: "#000000", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
                    <BarChart className="h-4 w-4 text-gray-600" />
                    Orders by Region
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={regionData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {regionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

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