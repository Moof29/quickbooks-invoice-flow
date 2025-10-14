import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface PortalUserLink {
  customer_id: string;
  organization_id: string;
  email_verified: boolean;
}

interface CustomerProfile {
  id: string;
  company_name: string;
  display_name: string;
  email: string;
  phone: string;
  organization_id: string;
}

interface PortalAuthContextType {
  user: User | null;
  session: Session | null;
  customerLink: PortalUserLink | null;
  customerProfile: CustomerProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [customerLink, setCustomerLink] = useState<PortalUserLink | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchPortalUserData(session.user.id);
          }, 0);
        } else {
          setCustomerLink(null);
          setCustomerProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchPortalUserData(session.user.id);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchPortalUserData = async (userId: string) => {
    try {
      // Check for secure impersonation token
      const impersonationToken = sessionStorage.getItem('portal_impersonation_token');
      
      if (impersonationToken) {
        // Validate token server-side using edge function
        const { data: validationData, error: validationError } = await supabase.functions.invoke(
          'validate-impersonation-token',
          { body: { token: impersonationToken } }
        );

        if (validationError || !validationData?.customerId) {
          console.error('Invalid impersonation token');
          sessionStorage.removeItem('portal_impersonation_token');
          setLoading(false);
          return;
        }
        
        const customerId = validationData.customerId;
        
        // Fetch customer profile for valid impersonation
        const { data: profileData, error: profileError } = await supabase
          .from('customer_profile')
          .select('id, company_name, display_name, email, phone, organization_id')
          .eq('id', customerId)
          .single();

        if (profileError) throw profileError;
        
        setCustomerLink({
          customer_id: customerId,
          organization_id: profileData.organization_id,
          email_verified: true
        });
        setCustomerProfile(profileData);
        setLoading(false);
        return;
      }

      // Normal portal user flow
      const { data: linkData, error: linkError } = await supabase
        .from('customer_portal_user_links')
        .select('customer_id, organization_id, email_verified')
        .eq('portal_user_id', userId)
        .single();

      if (linkError) throw linkError;

      setCustomerLink(linkData);

      // Fetch customer profile
      if (linkData?.customer_id) {
        const { data: profileData, error: profileError } = await supabase
          .from('customer_profile')
          .select('id, company_name, display_name, email, phone, organization_id')
          .eq('id', linkData.customer_id)
          .single();

        if (profileError) throw profileError;
        setCustomerProfile(profileData);
      }
    } catch (error) {
      console.error('Error fetching portal user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    // Clear impersonation token
    sessionStorage.removeItem('portal_impersonation_token');
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    customerLink,
    customerProfile,
    loading,
    signOut
  };

  return (
    <PortalAuthContext.Provider value={value}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export const usePortalAuth = () => {
  const context = useContext(PortalAuthContext);
  if (context === undefined) {
    throw new Error('usePortalAuth must be used within a PortalAuthProvider');
  }
  return context;
};
