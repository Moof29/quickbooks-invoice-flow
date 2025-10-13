import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useInventoryValidation(
  itemId?: string, 
  quantity?: number,
  organizationId?: string
) {
  return useQuery({
    queryKey: ['inventory-validation', itemId, quantity, organizationId],
    queryFn: async () => {
      if (!itemId || !organizationId) return null;

      const { data, error } = await supabase.rpc('validate_inventory_availability' as any, {
        p_item_id: itemId,
        p_quantity: quantity || 0,
        p_organization_id: organizationId,
      }) as { data: any; error: any };

      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!itemId && !!organizationId,
  });
}
