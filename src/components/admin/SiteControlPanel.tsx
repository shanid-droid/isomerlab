import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useMaintenanceMode } from '../../lib/maintenance';
import type { SiteSettings } from '../../lib/types';
import { DEFAULT_MAINTENANCE_MESSAGE } from '../../lib/constants';

const SiteControlPanel: React.FC = () => {
  const { maintenanceMode, maintenanceMessage, refresh } = useMaintenanceMode();
  const [localMessage, setLocalMessage] = useState(maintenanceMessage);
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      const s = data as SiteSettings;
      setLocalMessage(s.maintenance_message ?? DEFAULT_MAINTENANCE_MESSAGE);
      setLastUpdated(s.updated_at ?? null);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { setLocalMessage(maintenanceMessage); }, [maintenanceMessage]);

  const toggleMaintenance = async (enabled: boolean) => {
    setProcessing(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('set_maintenance_mode', {
        p_enabled: enabled,
        p_message: localMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE,
      });
      if (rpcError) throw rpcError;
      await refresh();
      await fetchSettings();
      setShowEnableConfirm(false);
      setShowDisableConfirm(false);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to update maintenance mode');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-white tracking-wider">SITE CONTROL</h2>
        <p className="font-mono-custom text-[10px] text-white/40 mt-1">Owner-only platform settings</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300 font-mono-custom">{error}</div>
      )}

      <div className="glass rounded-2xl p-6 border border-eg/20 space-y-6 max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono-custom text-xs tracking-widest text-white/60 uppercase">Maintenance Mode</p>
            <p className="font-sans text-xs text-white/40 mt-1">
              {maintenanceMode ? 'Platform is in maintenance — only home page is public' : 'Platform is fully operational'}
            </p>
          </div>
          <button
            onClick={() => maintenanceMode ? setShowDisableConfirm(true) : setShowEnableConfirm(true)}
            className={`relative w-14 h-7 rounded-full transition-colors ${maintenanceMode ? 'bg-eg' : 'bg-dark-300 border border-white/20'}`}
            aria-label="Toggle maintenance mode"
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${maintenanceMode ? 'left-7' : 'left-0.5'}`} />
          </button>
        </div>

        <div className="space-y-2">
          <label className="font-mono-custom text-[10px] text-white/50 uppercase tracking-wider">Maintenance Message</label>
          <textarea
            rows={3}
            value={localMessage}
            onChange={e => setLocalMessage(e.target.value)}
            className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white font-sans leading-relaxed focus:outline-none focus:border-eg"
            placeholder={DEFAULT_MAINTENANCE_MESSAGE}
          />
        </div>

        {lastUpdated && (
          <p className="font-mono-custom text-[10px] text-white/30">Last updated: {new Date(lastUpdated).toLocaleString()}</p>
        )}

        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-mono-custom text-[10px] tracking-wider uppercase ${
          maintenanceMode ? 'border-eg/40 bg-eg/10 text-eg' : 'border-white/20 bg-white/5 text-white/50'
        }`}>
          <span className={`w-2 h-2 rounded-full ${maintenanceMode ? 'bg-eg animate-pulse' : 'bg-white/30'}`} />
          {maintenanceMode ? 'ON' : 'OFF'}
        </div>
      </div>

      {showEnableConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-amber-500/30 p-6 max-w-md w-full space-y-4">
            <h3 className="font-display text-sm font-bold text-white">Enable maintenance mode?</h3>
            <p className="font-sans text-xs text-white/70 leading-relaxed">
              Users will only be able to access the main landing page. Other sections of the platform will be temporarily unavailable.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowEnableConfirm(false)} className="text-xs text-white/50 font-mono-custom">CANCEL</button>
              <button onClick={() => toggleMaintenance(true)} disabled={processing} className="btn-primary py-2 px-5 text-xs font-mono-custom">{processing ? 'ENABLING...' : 'ENABLE MAINTENANCE'}</button>
            </div>
          </div>
        </div>
      )}

      {showDisableConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-eg/30 p-6 max-w-md w-full space-y-4">
            <h3 className="font-display text-sm font-bold text-white">Disable maintenance mode and reopen the platform?</h3>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDisableConfirm(false)} className="text-xs text-white/50 font-mono-custom">CANCEL</button>
              <button onClick={() => toggleMaintenance(false)} disabled={processing} className="btn-primary py-2 px-5 text-xs font-mono-custom">{processing ? 'DISABLING...' : 'DISABLE'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteControlPanel;
