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

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Sales Orders', href: '/sales-orders', icon: ShoppingCart },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Products', href: '/items', icon: Package },
  { 
    name: 'Settings', 
    href: '/settings', 
    icon: Settings,
    subItems: [
      { name: 'QuickBooks', href: '/quickbooks', icon: Zap },
    ]
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthProfile();
  const { toast } = useToast();
  const isCollapsed = state === "collapsed";
  const [expandedItems, setExpandedItems] = useState<string[]>(['Settings']);

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
      
      <SidebarContent className="mt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  {item.subItems ? (
                    <div>
                      <SidebarMenuButton
                        onClick={() => {
                          const isExpanded = expandedItems.includes(item.name);
                          setExpandedItems(prev => 
                            isExpanded 
                              ? prev.filter(name => name !== item.name)
                              : [...prev, item.name]
                          );
                        }}
                        className="w-full"
                      >
                        <div className="flex items-center gap-3 px-3 py-2 w-full">
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {!isCollapsed && (
                            <>
                              <span className="text-sm font-medium flex-1">{item.name}</span>
                              {expandedItems.includes(item.name) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </>
                          )}
                        </div>
                      </SidebarMenuButton>
                      {!isCollapsed && expandedItems.includes(item.name) && (
                        <div className="ml-6 mt-1">
                          {item.subItems.map((subItem) => (
                            <SidebarMenuButton key={subItem.name} asChild>
                              <NavLink
                                to={subItem.href}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                    isActive 
                                      ? "bg-accent text-accent-foreground" 
                                      : "hover:bg-accent/50"
                                  }`
                                }
                              >
                                <subItem.icon className="h-4 w-4 flex-shrink-0" />
                                <span className="text-sm font-medium">{subItem.name}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
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
                  )}
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