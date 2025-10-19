import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileFABProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function MobileFAB({ onClick, label = 'Add', className }: MobileFABProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        'md:hidden fixed bottom-20 right-4 z-40',
        'h-14 w-14 rounded-full shadow-lg',
        'hover:scale-110 transition-transform',
        'touch-manipulation',
        className
      )}
      aria-label={label}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
