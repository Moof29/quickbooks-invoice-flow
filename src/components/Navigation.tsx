
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Zap,
  Settings,
  Menu,
  X
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'QuickBooks', href: '/quickbooks', icon: Zap },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Navigation = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="flex items-center">
                <div className="bg-blue-600 rounded-lg p-2">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <span className="ml-3 text-xl font-bold text-gray-900">InvoiceApp</span>
              </div>
            </div>
            <nav className="mt-8 flex-1 space-y-1 px-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      isActive
                        ? 'bg-blue-50 border-r-2 border-blue-600 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      'group flex items-center px-3 py-2 text-sm font-medium rounded-l-md transition-colors'
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
                        'mr-3 h-5 w-5'
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between bg-white px-4 py-2 border-b border-gray-200">
          <div className="flex items-center">
            <div className="bg-blue-600 rounded-lg p-2">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="ml-2 text-lg font-bold text-gray-900">InvoiceApp</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden">
            <div className="pt-2 pb-3 space-y-1 bg-white border-b border-gray-200">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      isActive
                        ? 'bg-blue-50 border-r-2 border-blue-600 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      'group flex items-center px-3 py-2 text-base font-medium'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
                        'mr-3 h-5 w-5'
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
