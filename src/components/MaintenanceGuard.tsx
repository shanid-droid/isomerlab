import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useMaintenanceMode } from '../lib/maintenance';
import { MAINTENANCE_EXEMPT_PATHS } from '../lib/constants';
import {
  bypassesMaintenance,
  canAccessAdminDuringMaintenance,
} from '../lib/roles';
import type { UserProfile } from '../lib/types';
import MaintenanceScreen from './MaintenanceScreen';

interface MaintenanceGuardProps {
  children: React.ReactNode;
}

const MaintenanceGuard: React.FC<MaintenanceGuardProps> = ({ children }) => {
  const location = useLocation();
  const { maintenanceMode, maintenanceMessage, loading: maintenanceLoading } = useMaintenanceMode();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) {
            setProfile(null);
            setProfileLoading(false);
          }
          return;
        }

        const { data } = await supabase
          .from('profiles')
          .select('id, role, full_name, email')
          .eq('id', user.id)
          .maybeSingle();

        if (mounted) {
          setProfile(data as UserProfile | null);
          setProfileLoading(false);
        }
      } catch {
        if (mounted) {
          setProfile(null);
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setProfile(null);
        setProfileLoading(false);
      } else {
        loadProfile();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const pathname = location.pathname;

  // Always allow exempt paths
  if ((MAINTENANCE_EXEMPT_PATHS as readonly string[]).includes(pathname)) {
    return <>{children}</>;
  }

  if (maintenanceLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-dark bg-circuit flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
          <span className="font-mono-custom text-xs tracking-widest text-eg/70 uppercase">
            CHECKING SYSTEM STATUS...
          </span>
        </div>
      </div>
    );
  }

  if (!maintenanceMode) {
    return <>{children}</>;
  }

  // Owner bypasses all maintenance restrictions
  if (bypassesMaintenance(profile)) {
    return <>{children}</>;
  }

  // Admin can access admin routes during maintenance
  if (canAccessAdminDuringMaintenance(profile, pathname)) {
    return <>{children}</>;
  }

  return <MaintenanceScreen message={maintenanceMessage} />;
};

export default MaintenanceGuard;
