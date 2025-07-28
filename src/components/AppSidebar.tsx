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
      className={isCollapsed ? "w-16" : "w-52"}
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive 
                            ? "bg-accent text-accent-foreground" 
                            : "hover:bg-accent/50"
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!isCollapsed && (
                        <span className="text-sm font-medium">{item.name}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button 
                variant="ghost" 
                className={`w-full transition-all ${
                  isCollapsed ? "justify-center px-2" : "justify-start px-3 gap-3"
                }`}
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span className="text-sm">Sign Out</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}