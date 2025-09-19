import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, AlertTriangle } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  description: string
  icon: React.ReactNode
  trend?: string
  trendUp?: boolean
}

function MetricCard({ title, value, description, icon, trend, trendUp }: MetricCardProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
        {trend && (
          <div className="flex items-center pt-1">
            <TrendingUp className={`h-3 w-3 mr-1 ${trendUp ? 'text-green-600' : 'text-red-600'}`} />
            <span className={`text-xs ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
              {trend} from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Revenue"
        value="$45,231.89"
        description="+20.1% from last month"
        icon={<DollarSign />}
        trend="+20.1%"
        trendUp={true}
      />
      
      <MetricCard
        title="Active Orders"
        value="2,350"
        description="+180.1% from last month"
        icon={<ShoppingCart />}
        trend="+180.1%"
        trendUp={true}
      />
      
      <MetricCard
        title="Total Customers"
        value="12,234"
        description="+19% from last month"
        icon={<Users />}
        trend="+19%"
        trendUp={true}
      />
      
      <MetricCard
        title="Items in Stock"
        value="1,234"
        description="+201 since last hour"
        icon={<Package />}
        trend="+201"
        trendUp={true}
      />
    </div>
  )
}

export function QuickStats() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Today's Orders</CardTitle>
          <CardDescription>Orders scheduled for delivery</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="text-2xl font-bold">24</div>
              <Progress value={75} className="mt-2" />
            </div>
            <Badge variant="secondary">+3 from yesterday</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">QuickBooks Sync</CardTitle>
          <CardDescription>Last sync status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-600">Synced</div>
              <div className="text-xs text-muted-foreground">2 minutes ago</div>
            </div>
            <Badge variant="default" className="bg-green-100 text-green-800">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Pending Approvals</CardTitle>
          <CardDescription>Orders waiting for approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">3</div>
              <div className="text-xs text-muted-foreground">Requires attention</div>
            </div>
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}