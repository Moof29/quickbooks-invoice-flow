import { useState } from 'react'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, Outlet } from "react-router-dom";
import { AuthProfileProvider, useAuthProfile } from "@/hooks/useAuthProfile";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  FileText,
  Home,
  LogOut,
  Package,
  Package2,
  Search,
  Settings as SettingsIcon,
  ShoppingCart,
  Truck,
  User,
  Users,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import SalesOrders from "./pages/SalesOrders";
import SalesOrderDetails from "./pages/SalesOrderDetails";
import Items from "./pages/Items";
import Customers from "./pages/Customers";
import QuickBooksIntegration from "./pages/QuickBooksIntegration";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthProfile();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function Sidebar({
  isCollapsed,
  setIsCollapsed,
}: {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
}) {
  const location = useLocation();
  const { user, profile, signOut } = useAuthProfile();
  const { toast } = useToast();

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, path: "/dashboard" },
    { id: "sales-orders", label: "Sales Orders", icon: ShoppingCart, path: "/sales-orders" },
    { id: "invoices", label: "Invoices", icon: FileText, path: "/invoices" },
    { id: "customers", label: "Customers", icon: Users, path: "/customers" },
    { id: "items", label: "Items", icon: Package, path: "/items" },
    { id: "quickbooks", label: "QuickBooks", icon: Truck, path: "/quickbooks" },
    { id: "settings", label: "Settings", icon: SettingsIcon, path: "/settings" },
  ]

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={cn("border-r bg-background transition-all duration-300 ease-in-out", isCollapsed ? "w-16" : "w-64")}
    >
      <div className="flex h-full flex-col">
        {/* Logo/Brand */}
        <div className="border-b px-6 py-4">
          <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
            <div className="flex items-center gap-2">
              <Package2 className="h-6 w-6 shrink-0 text-primary" />
              {!isCollapsed && (
                <span className="text-lg font-semibold text-foreground">Batchly</span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-6 py-4">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.path}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.path)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isCollapsed && "justify-center",
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && item.label}
              </Link>
            )
          })}
        </nav>

        {/* User section at bottom */}
        <div className="border-t px-6 py-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn("w-full gap-2 px-3 py-2 h-auto", isCollapsed ? "justify-center" : "justify-start")}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback>
                    {user?.email?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex flex-col items-start text-sm min-w-0 flex-1">
                    <span className="font-medium truncate w-full" title={user?.email}>
                      {user?.email}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {profile?.organization_id || "Organization"}
                    </span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  )
}

function Header() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Search bar */}
        <div className="relative w-80 ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
          </Button>
        </div>
      </div>
    </header>
  )
}

function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-muted/40">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

const App = () => (
  <AuthProfileProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/sales-orders" element={<SalesOrders />} />
              <Route path="/sales-orders/:id" element={<SalesOrderDetails />} />
              <Route path="/items" element={<Items />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/quickbooks" element={<QuickBooksIntegration />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProfileProvider>
);

export default App;