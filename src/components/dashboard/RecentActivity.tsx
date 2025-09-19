import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, CheckCircle, AlertCircle, Package } from "lucide-react"

interface Activity {
  id: string
  type: 'order' | 'invoice' | 'sync' | 'approval'
  title: string
  description: string
  time: string
  status: 'completed' | 'pending' | 'failed'
  user?: string
  userInitials?: string
}

const activities: Activity[] = [
  {
    id: '1',
    type: 'order',
    title: 'New sales order created',
    description: 'Order #SO-2024-001 for ABC Corporation',
    time: '2 minutes ago',
    status: 'completed',
    user: 'John Smith',
    userInitials: 'JS'
  },
  {
    id: '2',
    type: 'invoice',
    title: 'Invoice generated',
    description: 'Invoice #INV-2024-045 sent to customer',
    time: '15 minutes ago',
    status: 'completed',
    user: 'Sarah Johnson',
    userInitials: 'SJ'
  },
  {
    id: '3',
    type: 'sync',
    title: 'QuickBooks sync completed',
    description: '12 items synchronized successfully',
    time: '1 hour ago',
    status: 'completed'
  },
  {
    id: '4',
    type: 'approval',
    title: 'Order pending approval',
    description: 'Order #SO-2024-002 requires manager approval',
    time: '2 hours ago',
    status: 'pending',
    user: 'Mike Davis',
    userInitials: 'MD'
  },
  {
    id: '5',
    type: 'sync',
    title: 'Sync failed',
    description: 'QuickBooks connection timeout',
    time: '3 hours ago',
    status: 'failed'
  }
]

function getActivityIcon(type: Activity['type']) {
  switch (type) {
    case 'order':
      return <Package className="h-4 w-4" />
    case 'invoice':
      return <CheckCircle className="h-4 w-4" />
    case 'sync':
      return <Clock className="h-4 w-4" />
    case 'approval':
      return <AlertCircle className="h-4 w-4" />
    default:
      return <Clock className="h-4 w-4" />
  }
}

function getStatusBadge(status: Activity['status']) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
    case 'pending':
      return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Pending</Badge>
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    default:
      return null
  }
}

export function RecentActivity() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest updates from your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4 pb-4 border-b border-border/40 last:border-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium leading-none">
                      {activity.title}
                    </p>
                    {getStatusBadge(activity.status)}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {activity.time}
                    </p>
                    
                    {activity.user && (
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src="" />
                          <AvatarFallback className="text-xs">
                            {activity.userInitials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          {activity.user}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" className="w-full">
            View All Activity
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}