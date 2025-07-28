
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProfileProvider, useAuthProfile } from "@/hooks/useAuthProfile";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ContextualSidebar } from "@/components/ContextualSidebar";
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

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border" />
            <span className="text-sm font-medium">Batchly</span>
          </header>
          <div className="flex flex-1">
            <main className="flex-1 p-6">
              {children}
            </main>
            <ContextualSidebar />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
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
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Invoices />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales-orders"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SalesOrders />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales-orders/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SalesOrderDetails />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/items"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Items />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Customers />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quickbooks"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <QuickBooksIntegration />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProfileProvider>
);

export default App;
