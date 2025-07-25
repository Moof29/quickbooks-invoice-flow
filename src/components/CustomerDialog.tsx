
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CustomerDialog = ({ open, onOpenChange, onSuccess }: CustomerDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    company_name: '',
    email: '',
    phone: '',
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_state: '',
    billing_postal_code: '',
    billing_country: 'US',
    notes: '',
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Get organization_id from authenticated user context
      const organization_id = '00000000-0000-0000-0000-000000000000'; // Placeholder - should come from auth
      
      const { error } = await supabase
        .from('customer_profile')
        .insert({
          organization_id,
          display_name: formData.display_name,
          company_name: formData.company_name || null,
          email: formData.email || null,
          phone: formData.phone || null,
          billing_address_line1: formData.billing_address_line1 || null,
          billing_address_line2: formData.billing_address_line2 || null,
          billing_city: formData.billing_city || null,
          billing_state: formData.billing_state || null,
          billing_postal_code: formData.billing_postal_code || null,
          billing_country: formData.billing_country || null,
          notes: formData.notes || null,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer created successfully",
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "Failed to create customer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      display_name: '',
      company_name: '',
      email: '',
      phone: '',
      billing_address_line1: '',
      billing_address_line2: '',
      billing_city: '',
      billing_state: '',
      billing_postal_code: '',
      billing_country: 'US',
      notes: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
          <DialogDescription>
            Create a new customer profile. Fill in the required information below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                placeholder="John Doe or Company Name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                placeholder="ABC Company Inc."
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Billing Address */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Billing Address</h3>
            
            <div className="space-y-2">
              <Label htmlFor="billing_address_line1">Address Line 1</Label>
              <Input
                id="billing_address_line1"
                placeholder="123 Main Street"
                value={formData.billing_address_line1}
                onChange={(e) => setFormData({ ...formData, billing_address_line1: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_address_line2">Address Line 2</Label>
              <Input
                id="billing_address_line2"
                placeholder="Suite 100"
                value={formData.billing_address_line2}
                onChange={(e) => setFormData({ ...formData, billing_address_line2: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing_city">City</Label>
                <Input
                  id="billing_city"
                  placeholder="New York"
                  value={formData.billing_city}
                  onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_state">State</Label>
                <Input
                  id="billing_state"
                  placeholder="NY"
                  value={formData.billing_state}
                  onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_postal_code">Postal Code</Label>
                <Input
                  id="billing_postal_code"
                  placeholder="10001"
                  value={formData.billing_postal_code}
                  onChange={(e) => setFormData({ ...formData, billing_postal_code: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_country">Country</Label>
              <Input
                id="billing_country"
                placeholder="US"
                value={formData.billing_country}
                onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this customer"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
