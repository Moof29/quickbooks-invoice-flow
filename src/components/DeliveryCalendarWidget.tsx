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
        .from('sales_order')
        .select('delivery_date')
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
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Delivery Calendar</CardTitle>
        <p className="text-sm text-muted-foreground">
          Click a date to filter orders by delivery date
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <Calendar
          mode="single"
          selected={calendarDate}
          onSelect={handleDateSelect}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          className={cn("p-0 pointer-events-auto")}
          components={{
            DayContent: ({ date }) => {
              const orderCount = getOrderCountForDate(date);
              return (
                <div className="relative w-full h-full flex items-center justify-center">
                  <span>{format(date, 'd')}</span>
                  {orderCount > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {orderCount}
                    </Badge>
                  )}
                </div>
              );
            },
          }}
        />
        
        {selectedDate && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <p className="text-sm font-medium">
              Selected: {format(selectedDate, 'EEEE, MMM dd, yyyy')}
            </p>
            <p className="text-xs text-muted-foreground">
              {getOrderCountForDate(selectedDate)} order(s) for delivery
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}