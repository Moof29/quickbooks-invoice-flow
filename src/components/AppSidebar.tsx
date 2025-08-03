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
      className={isCollapsed ? "w-16 md:w-20" : "w-64 md:w-72 lg:w-80"}
    >
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-4 py-4 md:px-6 md:py-5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-10 w-10 md:h-12 md:w-12 touch-target"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
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
            <span className="text-lg md:text-xl font-semibold">Batchly</span>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="mt-6 md:mt-8">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2 md:space-y-3">
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center gap-4 px-4 py-3 md:px-6 md:py-4 rounded-lg transition-colors touch-target ${
                          isActive 
                            ? "bg-accent text-accent-foreground" 
                            : "hover:bg-accent/50"
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0" />
                      {!isCollapsed && (
                        <span className="text-base md:text-lg font-medium">{item.name}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button 
                variant="ghost" 
                className={`w-full transition-all touch-target ${
                  isCollapsed ? "justify-center px-2" : "justify-start px-4 md:px-6 gap-4"
                } h-12 md:h-14`}
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0" />
                {!isCollapsed && <span className="text-base md:text-lg">Sign Out</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}