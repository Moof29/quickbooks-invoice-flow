import { TeamManagement } from '@/components/TeamManagement';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImportCSVDialog } from '@/components/ImportCSVDialog';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { useState } from 'react';

export default function Settings() {
  const { organization, profile, roles } = useAuthProfile();
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage your organization settings and team members
        </p>
      </div>

      {organization && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Organization Information</CardTitle>
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

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Import Existing QBO Data</CardTitle>
          <CardDescription>
            Import your existing items, customers, and invoices from QuickBooks Online CSV exports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV Files
          </Button>
        </CardContent>
      </Card>

      <TeamManagement />
      
      <ImportCSVDialog 
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </div>
  );
}