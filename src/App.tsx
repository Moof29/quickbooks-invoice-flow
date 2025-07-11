
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import Customers from "./pages/Customers";
import QuickBooksIntegration from "./pages/QuickBooksIntegration";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route
            path="/dashboard"
            element={
              <div className="lg:pl-64">
                <Navigation />
                <Dashboard />
              </div>
            }
          />
          <Route
            path="/invoices"
            element={
              <div className="lg:pl-64">
                <Navigation />
                <Invoices />
              </div>
            }
          />
          <Route
            path="/customers"
            element={
              <div className="lg:pl-64">
                <Navigation />
                <Customers />
              </div>
            }
          />
          <Route
            path="/quickbooks"
            element={
              <div className="lg:pl-64">
                <Navigation />
                <QuickBooksIntegration />
              </div>
            }
          />
          <Route
            path="/settings"
            element={
              <div className="lg:pl-64">
                <Navigation />
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Settings</h1>
                    <p className="text-gray-600">Settings page coming soon...</p>
                  </div>
                </div>
              </div>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
