import { Home, FileText, Users, Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function MobileBottomNav() {
  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Home' },
    { href: '/sales-orders', icon: FileText, label: 'Orders' },
    { href: '/customers', icon: Users, label: 'Customers' },
    { href: '/settings', icon: Menu, label: 'More' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 text-xs transition-colors touch-manipulation',
                'min-h-[44px]', // Touch target size
                isActive
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('h-5 w-5', isActive && 'fill-primary/20')} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
