
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, Outlet } from "react-router-dom";
import { AuthProfileProvider, useAuthProfile } from "@/hooks/useAuthProfile";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

function AppLayout() {
  const location = useLocation();
  const { user, profile, signOut } = useAuthProfile();
  const { toast } = useToast();

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
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-background">
        <div className="flex h-full flex-col">
          {/* Logo/Brand */}
          <div className="border-b px-6 py-4">
            <Link to="/dashboard" className="flex items-center gap-2">
              <Package2 className="h-6 w-6" />
              <span className="text-lg font-semibold">Batchly</span>
            </Link>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-6 py-4">
            <Link
              to="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive("/dashboard") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              style={{ borderLeft: '1px solid blue' }}
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            
            <Link
              to="/sales-orders"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive("/sales-orders") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <ShoppingCart className="h-4 w-4" />
              Sales Orders
            </Link>
            
            <Link
              to="/invoices"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive("/invoices") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <FileText className="h-4 w-4" />
              Invoices
            </Link>
            
            <Link
              to="/customers"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive("/customers") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Users className="h-4 w-4" />
              Customers
            </Link>
            
            <Link
              to="/items"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive("/items") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Package className="h-4 w-4" />
              Items
            </Link>
            
            <Link
              to="/quickbooks"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive("/quickbooks") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Truck className="h-4 w-4" />
              QuickBooks
            </Link>
          </nav>
          
          {/* User section at bottom */}
          <div className="border-t px-6 py-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 px-3 py-2 h-auto">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback>
                      {user?.email?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm min-w-0 flex-1">
                    <span className="font-medium truncate w-full" title={user?.email}>
                      {user?.email}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {profile?.organization_id || "Organization"}
                    </span>
                  </div>
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
      
      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header bar */}
        <header className="border-b bg-background">
          <div className="flex h-16 items-center gap-4 px-6" style={{ borderLeft: '3px solid red' }}>
            <div className="flex-1" style={{ borderLeft: '1px solid blue' }}>
              {/* Page-specific header content will go here */}
              <div className="text-sm text-muted-foreground">Debug: Header content area</div>
            </div>
            
            {/* Header actions */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
              </Button>
            </div>
          </div>
        </header>
        
        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-muted/40">
          <Outlet />
        </main>
      </div>
    </div>
  );
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
