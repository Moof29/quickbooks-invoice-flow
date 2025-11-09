import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, UserX } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_by: string;
  expires_at: string;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'warehouse_staff', label: 'Warehouse Staff' },
  { value: 'delivery_driver', label: 'Delivery Driver' },
  { value: 'customer_service', label: 'Customer Service' },
];

export function TeamManagement() {
  const { profile, organization, isAdmin } = useAuthProfile();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (organization?.id && isAdmin) {
      fetchTeamData();
    }
  }, [organization?.id, isAdmin]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      
      // Fetch team members from profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, created_at')
        .eq('organization_id', organization!.id)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for each team member
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map(p => p.id);
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        }

        // Combine profiles with their roles
        const membersWithRoles = profiles.map(profile => {
          const userRole = rolesData?.find(r => r.user_id === profile.id);
          return {
            ...profile,
            role: userRole?.role || 'customer_service' // Default role
          };
        });

        setTeamMembers(membersWithRoles);
      } else {
        setTeamMembers([]);
      }

      // Note: organization_invitations table doesn't exist yet
      // Leaving empty for now - you can add this feature later
      setInvitations([]);
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load team data. Please check your permissions."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteRole) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all fields"
      });
      return;
    }

    try {
      setInviting(true);
      
      toast({
        title: "Feature Coming Soon",
        description: "Team invitations will be available in a future update. For now, have users sign up directly and contact an admin to assign roles."
      });

      setInviteEmail('');
      setInviteRole('');
      setInviteDialogOpen(false);
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send invitation"
      });
    } finally {
      setInviting(false);
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    // This will be implemented when invitation system is added
    toast({
      title: "Feature Coming Soon",
      description: "Invitation management will be available in a future update"
    });
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>
            You need admin privileges to manage team members.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>Loading team data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage your organization's team members and send invitations
            </CardDescription>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInviteUser} disabled={inviting}>
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    {member.first_name} {member.last_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {ROLE_OPTIONS.find(r => r.value === member.role)?.label || member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">Active</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              Invitations that haven't been accepted yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {invitation.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_OPTIONS.find(r => r.value === invitation.role)?.label || invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelInvitation(invitation.id)}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}