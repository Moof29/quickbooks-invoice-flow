import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Users,
  Zap,
  Settings,
  LogOut,
  ShoppingCart,
  Package,
  Package2,
  Shield
} from 'lucide-react';
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Sales Orders', href: '/sales-orders', icon: ShoppingCart },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Products', href: '/items', icon: Package },
  { name: 'Warehouse', href: '/warehouse', icon: Package2 },
  { name: 'QuickBooks', href: '/quickbooks', icon: Zap },
  { name: 'Security', href: '/security', icon: Shield },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuthProfile();
  const { toast } = useToast();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      navigate('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sidebar collapsible="icon">
      {/* Header with logo */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className={cn(
          "flex items-center gap-2",
          isCollapsed && "justify-center"
        )}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary shrink-0">
            <Package2 className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-semibold text-sidebar-foreground">Batchly</span>
          )}
        </div>
      </SidebarHeader>
      
      {/* Main navigation */}
      <SidebarContent className={cn("py-4", isCollapsed ? "px-0" : "px-3")}>
        <SidebarMenu className={cn("gap-1", isCollapsed && "items-center")}>
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <SidebarMenuItem key={item.name} className={isCollapsed ? "flex justify-center w-full" : ""}>
                <SidebarMenuButton
                  onClick={() => navigate(item.href)}
                  isActive={isActive}
                  tooltip={item.name}
                  className={cn(
                    "text-sidebar-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                  )}
                >
                  <item.icon className="shrink-0" />
                  <span>{item.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      
      {/* Footer with sign out */}
      <SidebarFooter className={cn("border-t border-sidebar-border py-3", isCollapsed ? "px-0" : "px-3")}>
        <SidebarMenu className={isCollapsed ? "items-center" : ""}>
          <SidebarMenuItem className={isCollapsed ? "flex justify-center w-full" : ""}>
            <SidebarMenuButton 
              onClick={handleSignOut}
              tooltip="Sign Out"
              className="text-sidebar-foreground"
            >
              <LogOut className="shrink-0" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}