import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts"

const salesData = [
  { name: "Jan", total: 12400, orders: 45 },
  { name: "Feb", total: 19800, orders: 62 },
  { name: "Mar", total: 15200, orders: 48 },
  { name: "Apr", total: 22100, orders: 73 },
  { name: "May", total: 18900, orders: 59 },
  { name: "Jun", total: 25400, orders: 81 },
  { name: "Jul", total: 21800, orders: 68 }
]

const revenueData = [
  { month: "Jan", revenue: 4800, target: 5000 },
  { month: "Feb", revenue: 5200, target: 5000 },
  { month: "Mar", revenue: 4100, target: 5000 },
  { month: "Apr", revenue: 6200, target: 5000 },
  { month: "May", revenue: 5800, target: 5000 },
  { month: "Jun", revenue: 7200, target: 5000 }
]

const categoryData = [
  { name: "Electronics", value: 35, color: "hsl(var(--primary))" },
  { name: "Office Supplies", value: 25, color: "hsl(var(--secondary))" },
  { name: "Furniture", value: 20, color: "hsl(var(--accent))" },
  { name: "Hardware", value: 12, color: "hsl(var(--muted))" },
  { name: "Other", value: 8, color: "hsl(var(--border))" }
]

export function SalesOverview() {
  return (
    <Card className="border-0 shadow-sm col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>
              Monthly sales performance and trends
            </CardDescription>
          </div>
          <Badge variant="secondary">Last 7 months</Badge>
        </div>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={salesData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="name" 
              className="text-sm fill-muted-foreground"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              className="text-sm fill-muted-foreground"
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px"
              }}
            />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function RevenueChart() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Revenue vs Target</CardTitle>
        <CardDescription>
          Monthly revenue comparison
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              className="text-sm fill-muted-foreground"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              className="text-sm fill-muted-foreground"
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px"
              }}
            />
            <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="target" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function CategoryBreakdown() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Sales by Category</CardTitle>
        <CardDescription>
          Distribution of sales across categories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px"
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        <div className="mt-4 space-y-2">
          {categoryData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
              </div>
              <span className="font-medium">{item.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}