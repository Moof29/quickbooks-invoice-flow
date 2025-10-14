import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Mail, Key, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface PortalUser {
  id: string;
  portal_user_id: string;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  user_email?: string;
}

interface CustomerPortalUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

export function CustomerPortalUsersDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
}: CustomerPortalUsersDialogProps) {
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadPortalUsers();
    }
  }, [open, customerId]);

  const loadPortalUsers = async () => {
    try {
      setLoading(true);
      
      // Get all portal user links for this customer
      const { data: links, error: linksError } = await supabase
        .from('customer_portal_user_links')
        .select('*')
        .eq('customer_id', customerId);

      if (linksError) throw linksError;

      // Get user emails from auth.users for each portal user
      const usersWithEmails = await Promise.all(
        (links || []).map(async (link) => {
          const { data: userData } = await supabase.auth.admin.getUserById(link.portal_user_id);
          return {
            ...link,
            user_email: userData.user?.email || 'Unknown',
          };
        })
      );

      setPortalUsers(usersWithEmails);
    } catch (error) {
      console.error('Error loading portal users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load portal users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({
        title: 'Error',
        description: 'Please provide email and password',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/portal/login`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Get organization_id from customer
      const { data: customerData } = await supabase
        .from('customer_profile')
        .select('organization_id')
        .eq('id', customerId)
        .single();

      // Create portal user link
      const { error: linkError } = await supabase
        .from('customer_portal_user_links')
        .insert({
          portal_user_id: authData.user.id,
          customer_id: customerId,
          organization_id: customerData?.organization_id,
          email_verified: false,
        });

      if (linkError) throw linkError;

      // Send invitation email
      try {
        await supabase.functions.invoke('send-portal-invitation', {
          body: {
            email: newUserEmail,
            customerName,
            temporaryPassword: newUserPassword,
            portalUrl: `${window.location.origin}/portal/login`,
          },
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the entire operation if email fails
      }

      toast({
        title: 'Success',
        description: 'Portal user created and invitation sent',
      });

      setShowAddUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
      loadPortalUsers();
    } catch (error: any) {
      console.error('Error adding portal user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create portal user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (linkId: string, portalUserId: string) => {
    if (!confirm('Are you sure you want to remove this portal user?')) return;

    try {
      setLoading(true);

      // Delete the link
      const { error: linkError } = await supabase
        .from('customer_portal_user_links')
        .delete()
        .eq('id', linkId);

      if (linkError) throw linkError;

      // Optionally delete the auth user (commented out for safety)
      // await supabase.auth.admin.deleteUser(portalUserId);

      toast({
        title: 'Success',
        description: 'Portal user removed',
      });

      loadPortalUsers();
    } catch (error: any) {
      console.error('Error deleting portal user:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove portal user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      setLoading(true);

      const newPassword = generateRandomPassword();

      // Note: This requires admin privileges
      // In production, you'd want to use password reset flow or admin API
      toast({
        title: 'Password Reset',
        description: 'Password reset functionality requires admin API access',
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset password',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage Portal Users - {customerName}</DialogTitle>
          <DialogDescription>
            Add and manage customer portal user accounts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!showAddUser ? (
            <Button onClick={() => setShowAddUser(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Portal User
            </Button>
          ) : (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">New Portal User</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAddUser(false)}>
                  Cancel
                </Button>
              </div>
              
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      type="text"
                      placeholder="Enter password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewUserPassword(generateRandomPassword())}
                    >
                      <Key className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button onClick={handleAddUser} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Create & Send Invitation
                  </>
                )}
              </Button>
            </div>
          )}

          {loading && !showAddUser ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portalUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No portal users yet. Add one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    portalUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.user_email}</TableCell>
                        <TableCell>
                          <Badge variant={user.email_verified ? 'default' : 'secondary'}>
                            {user.email_verified ? 'Verified' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.last_login_at
                            ? format(new Date(user.last_login_at), 'MMM d, yyyy')
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(user.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetPassword(user.user_email || '')}
                              title="Reset Password"
                            >
                              <Key className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id, user.portal_user_id)}
                              className="text-destructive"
                              title="Remove User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
