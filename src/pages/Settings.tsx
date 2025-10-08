import { TeamManagement } from '@/components/TeamManagement';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Settings() {
  const { organization, profile, roles } = useAuthProfile();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings and team members
        </p>
      </div>

      {organization && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Information</CardTitle>
            <CardDescription>
              Basic information about your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Organization Name</label>
              <p className="text-sm text-muted-foreground">{organization.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Your Role(s)</label>
              <p className="text-sm text-muted-foreground capitalize">
                {roles.length > 0 ? roles.join(', ') : 'No roles assigned'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Plan Type</label>
              <p className="text-sm text-muted-foreground">{organization.plan_type || 'Free'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <TeamManagement />
    </div>
  );
}