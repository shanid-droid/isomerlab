import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { SiteSettings } from './types';
import { DEFAULT_MAINTENANCE_MESSAGE } from './constants';

interface UseMaintenanceModeResult {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useMaintenanceMode(): UseMaintenanceModeResult {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('id, maintenance_mode, maintenance_message, updated_at')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.warn('[useMaintenanceMode] Could not fetch site settings:', error.message);
        setSettings({ id: 1, maintenance_mode: false, maintenance_message: DEFAULT_MAINTENANCE_MESSAGE });
      } else {
        setSettings(data as SiteSettings | null ?? {
          id: 1,
          maintenance_mode: false,
          maintenance_message: DEFAULT_MAINTENANCE_MESSAGE,
        });
      }
    } catch {
      setSettings({ id: 1, maintenance_mode: false, maintenance_message: DEFAULT_MAINTENANCE_MESSAGE });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    maintenanceMode: settings?.maintenance_mode ?? false,
    maintenanceMessage: settings?.maintenance_message ?? DEFAULT_MAINTENANCE_MESSAGE,
    loading,
    refresh: fetchSettings,
  };
}
