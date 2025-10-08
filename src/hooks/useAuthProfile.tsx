import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  role: string;
  organization_id: string;
}

interface Organization {
  id: string;
  name: string;
  industry?: string;
  plan_type?: string;
  timezone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthProfileContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  roles: string[];
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  hasRole: (role: string) => boolean;
}

const AuthProfileContext = createContext<AuthProfileContextType | undefined>(undefined);

export function AuthProfileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetching to avoid deadlock
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setOrganization(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchUserProfile(session.user.id);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Fetch profile data (without role)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, organization_id, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      // Fetch user roles from user_roles table (using type assertion for new table)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      } else {
        setRoles((rolesData as any)?.map((r: any) => r.role) || []);
      }

      // Fetch organization data
      if (profileData?.organization_id) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profileData.organization_id)
          .single();

        if (orgError) throw orgError;
        setOrganization(orgData);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: string) => roles.includes(role);
  const isAdmin = hasRole('admin');

  const value = {
    user,
    session,
    profile,
    organization,
    roles,
    loading,
    signOut,
    isAdmin,
    hasRole
  };

  return (
    <AuthProfileContext.Provider value={value}>
      {children}
    </AuthProfileContext.Provider>
  );
}

export const useAuthProfile = () => {
  const context = useContext(AuthProfileContext);
  if (context === undefined) {
    throw new Error('useAuthProfile must be used within an AuthProfileProvider');
  }
  return context;
};