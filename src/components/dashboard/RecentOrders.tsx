import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Order {
  id: string
  customer: string
  customerInitials: string
  amount: string
  status: 'pending' | 'approved' | 'delivered' | 'cancelled'
  date: string
  items: number
}

const orders: Order[] = [
  {
    id: "SO-2024-001",
    customer: "ABC Corporation",
    customerInitials: "AC",
    amount: "$2,400.00",
    status: "approved",
    date: "2024-01-15",
    items: 12
  },
  {
    id: "SO-2024-002",
    customer: "XYZ Industries",
    customerInitials: "XI",
    amount: "$1,800.00",
    status: "pending",
    date: "2024-01-15",
    items: 8
  },
  {
    id: "SO-2024-003",
    customer: "Tech Solutions Inc",
    customerInitials: "TS",
    amount: "$3,200.00",
    status: "delivered",
    date: "2024-01-14",
    items: 15
  },
  {
    id: "SO-2024-004",
    customer: "Global Supplies",
    customerInitials: "GS",
    amount: "$950.00",
    status: "approved",
    date: "2024-01-14",
    items: 5
  },
  {
    id: "SO-2024-005",
    customer: "Modern Office Co",
    customerInitials: "MO",
    amount: "$4,100.00",
    status: "pending",
    date: "2024-01-13",
    items: 22
  }
]

function getStatusBadge(status: Order['status']) {
  switch (status) {
    case 'pending':
      return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Pending</Badge>
    case 'approved':
      return <Badge variant="default" className="bg-blue-100 text-blue-800">Approved</Badge>
    case 'delivered':
      return <Badge variant="default" className="bg-green-100 text-green-800">Delivered</Badge>
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>
    default:
      return null
  }
}

export function RecentOrders() {
  return (
    <Card className="border-0 shadow-sm col-span-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>
              Latest sales orders from your customers
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="" />
                      <AvatarFallback className="text-xs">
                        {order.customerInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{order.customer}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {order.id}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {order.items} items
                  </Badge>
                </TableCell>
                <TableCell>
                  {getStatusBadge(order.status)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(order.date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {order.amount}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Order
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}