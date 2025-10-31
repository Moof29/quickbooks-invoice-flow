import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface DeliveryCalendarWidgetProps {
  onDateSelect?: (date: Date | null) => void;
  selectedDate?: Date | null;
}

export function DeliveryCalendarWidget({ onDateSelect, selectedDate }: DeliveryCalendarWidgetProps) {
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(selectedDate || undefined);

  // Fetch order counts per delivery date
  const { data: orderCounts } = useQuery({
    queryKey: ['order-counts-by-delivery-date'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_record')
        .select('delivery_date')
        .in('status', ['pending', 'invoiced'])
        .not('delivery_date', 'is', null);

      if (error) throw error;

      // Count orders per delivery date
      const counts: Record<string, number> = {};
      data.forEach((order) => {
        const dateKey = order.delivery_date;
        counts[dateKey] = (counts[dateKey] || 0) + 1;
      });

      return counts;
    },
  });

  const getOrderCountForDate = (date: Date): number => {
    if (!orderCounts) return 0;
    const dateKey = format(date, 'yyyy-MM-dd');
    return orderCounts[dateKey] || 0;
  };

  const handleDateSelect = (date: Date | undefined) => {
    setCalendarDate(date);
    onDateSelect?.(date || null);
  };

  const modifiers = {
    hasOrders: (date: Date) => getOrderCountForDate(date) > 0,
  };

  const modifiersStyles = {
    hasOrders: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'hsl(var(--primary-foreground))',
      fontWeight: 'bold',
    },
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
      <div className="mb-2">
        <p className="text-sm font-medium text-foreground">Delivery Calendar</p>
        <p className="text-xs text-muted-foreground">Select a date to filter</p>
      </div>
      <Calendar
        mode="single"
        selected={calendarDate}
        onSelect={handleDateSelect}
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
        className={cn("p-0 pointer-events-auto border-0")}
        components={{
          DayContent: ({ date }) => {
            const orderCount = getOrderCountForDate(date);
            return (
              <div className="relative w-full h-full flex items-center justify-center">
                <span className="text-xs">{format(date, 'd')}</span>
                {orderCount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="absolute -top-1 -right-1 h-3 w-3 p-0 flex items-center justify-center text-[10px] leading-none"
                  >
                    {orderCount > 9 ? '9+' : orderCount}
                  </Badge>
                )}
              </div>
            );
          },
        }}
      />
      
      {selectedDate && (
        <div className="mt-2 p-2 bg-muted/30 rounded text-center">
          <p className="text-xs font-medium text-foreground">
            {format(selectedDate, 'MMM dd')}
          </p>
          <p className="text-xs text-muted-foreground">
            {getOrderCountForDate(selectedDate)} orders
          </p>
        </div>
      )}
    </div>
  );
}