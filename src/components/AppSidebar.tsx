import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users,
  Zap,
  Settings,
  LogOut,
  ShoppingCart,
  Package,
  ChevronDown,
  ChevronRight
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const navigationGroups = [
  {
    label: "General",
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ]
  },
  {
    label: "Sales",
    items: [
      { name: 'Sales Orders', href: '/sales-orders', icon: ShoppingCart },
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Customers', href: '/customers', icon: Users },
    ]
  },
  {
    label: "Inventory",
    items: [
      { name: 'Products', href: '/items', icon: Package },
    ]
  },
  {
    label: "Integration",
    items: [
      { name: 'QuickBooks', href: '/quickbooks', icon: Zap },
    ]
  },
  {
    label: "Other",
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ]
  }
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthProfile();
  const { toast } = useToast();
  const isCollapsed = state === "collapsed";
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['General', 'Sales']);

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

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupLabel)
        ? prev.filter(label => label !== groupLabel)
        : [...prev, groupLabel]
    );
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className={isCollapsed ? "w-16" : "w-52"}
    >
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8"
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
            <span className="text-sm font-semibold">Batchly</span>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-2">
        {navigationGroups.map((group, groupIndex) => (
          <div key={group.label} className={groupIndex > 0 ? "mt-6" : ""}>
            {!isCollapsed && (
              <Collapsible
                open={expandedGroups.includes(group.label)}
                onOpenChange={() => toggleGroup(group.label)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between px-2 py-1 h-auto text-xs font-medium text-muted-foreground hover:text-foreground mb-1"
                  >
                    {group.label}
                    {expandedGroups.includes(group.label) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroup>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => (
                          <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={item.href}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm ${
                                    isActive 
                                      ? "bg-accent text-accent-foreground font-medium" 
                                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                                  }`
                                }
                              >
                                <item.icon className="h-4 w-4 flex-shrink-0" />
                                <span>{item.name}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {isCollapsed && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.href}
                            className={({ isActive }) =>
                              `flex items-center justify-center p-2 rounded-md transition-colors ${
                                isActive 
                                  ? "bg-accent text-accent-foreground" 
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                              }`
                            }
                          >
                            <item.icon className="h-4 w-4" />
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </div>
        ))}
      </SidebarContent>
      
      <SidebarFooter className="border-t mt-auto">
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