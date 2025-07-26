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
  const { state } = useSidebar();
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

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="bg-primary rounded-lg p-2 flex-shrink-0">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold text-foreground">Batchly</span>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <NavLink to={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-auto p-2" 
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                {!isCollapsed && <span>Sign Out</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}