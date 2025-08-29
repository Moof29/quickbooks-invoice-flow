import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModernPageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showDateRange?: boolean;
  dateRangeText?: string;
  className?: string;
}

export function ModernPageHeader({
  title,
  description,
  children,
  showSearch = false,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  showDateRange = false,
  dateRangeText,
  className,
}: ModernPageHeaderProps) {
  return (
    <div className={cn(
      "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left side - Title and description */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="page-title">{title}</h1>
            {description && (
              <p className="page-description">{description}</p>
            )}
          </div>
          {showDateRange && dateRangeText && (
            <Badge variant="secondary" className="btn-text-sm">
              <Calendar className="w-3 h-3 mr-1" />
              {dateRangeText}
            </Badge>
          )}
        </div>

        {/* Right side - Search and Actions */}
        <div className="flex items-center gap-3">
          {showSearch && (
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-10 h-9 bg-background border-input"
              />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}