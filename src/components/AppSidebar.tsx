import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Zap,
  Settings,
  LogOut,
  ShoppingCart,
  Package
} from 'lucide-react';
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Sales Orders', href: '/sales-orders', icon: ShoppingCart },
  { name: 'Items', href: '/items', icon: Package },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'QuickBooks', href: '/quickbooks', icon: Zap },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthProfile();
  const { toast } = useToast();
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
    <Sidebar 
      collapsible="icon" 
      className={`${isCollapsed ? "w-20" : "w-80"} border-r-2 border-border/50 bg-sidebar backdrop-blur-sm transition-all duration-300`}
    >
      <SidebarHeader className="border-b-2 border-border/50 bg-sidebar/50">
        <div className="flex items-center gap-4 px-6 py-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-12 w-12 hover:bg-sidebar-accent transition-all duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </Button>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <span className="text-2xl font-bold text-sidebar-primary">Batchly</span>
              <div className="text-sm text-sidebar-foreground/70 font-medium">Enterprise ERP</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="mt-8">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-3">
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 touch-target group ${
                          isActive 
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg transform scale-105" 
                            : "hover:bg-sidebar-accent/70 hover:scale-102 hover:shadow-md"
                        }`
                      }
                    >
                      <item.icon className="h-6 w-6 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                      {!isCollapsed && (
                        <span className="text-lg font-semibold transition-all duration-200">{item.name}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="mt-auto border-t-2 border-border/50 bg-sidebar/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button 
                variant="ghost" 
                className={`w-full transition-all duration-200 touch-target hover:bg-destructive/10 hover:text-destructive ${
                  isCollapsed ? "justify-center px-2" : "justify-start px-6 gap-4"
                } h-16`}
                onClick={handleSignOut}
              >
                <LogOut className="h-6 w-6 flex-shrink-0" />
                {!isCollapsed && <span className="text-lg font-semibold">Sign Out</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}