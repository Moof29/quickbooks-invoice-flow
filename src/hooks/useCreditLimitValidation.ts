import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCreditLimitValidation(customerId?: string, orderTotal?: number) {
  return useQuery({
    queryKey: ['credit-limit-validation', customerId, orderTotal],
    queryFn: async () => {
      if (!customerId) return null;

      const { data, error } = await supabase.rpc('validate_customer_credit_limit' as any, {
        p_customer_id: customerId,
        p_new_order_total: orderTotal || 0,
      }) as { data: any; error: any };

      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!customerId,
  });
}
