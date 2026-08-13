import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { CreatorApplication } from '../../lib/types';

interface CreatorApplicationsPanelProps {
  isOwner: boolean;
}

const CreatorApplicationsPanel: React.FC<CreatorApplicationsPanelProps> = () => {
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<CreatorApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: sbError } = await supabase
        .from('creator_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (sbError) throw sbError;
      setApplications((data as CreatorApplication[]) || []);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const handleApprove = async (app: CreatorApplication) => {
    if (!confirm(`Approve ${app.full_name} as Creator?`)) return;
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('review_creator_application', {
        p_application_id: app.id,
        p_action: 'approve',
      });
      if (error) throw error;
      await fetchApplications();
      setSelectedApp(null);
    } catch (err: unknown) {
      alert((err as Error)?.message ?? 'Failed to approve application');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('review_creator_application', {
        p_application_id: selectedApp.id,
        p_action: 'reject',
        p_rejection_reason: rejectReason.trim() || null,
      });
      if (error) throw error;
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedApp(null);
      await fetchApplications();
    } catch (err: unknown) {
      alert((err as Error)?.message ?? 'Failed to reject application');
    } finally {
      setProcessing(false);
    }
  };

  const filtered = applications.filter(a =>
    filterStatus === 'all' ? true : a.status === filterStatus
  );

  const pendingCount = applications.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white tracking-wider">CREATOR APPLICATIONS</h2>
          <p className="font-mono-custom text-[10px] text-white/40 mt-1">{pendingCount} pending review</p>
        </div>
        <div className="flex gap-1 bg-dark-200/60 p-1 rounded-xl border border-eg/10">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg font-mono-custom text-[10px] uppercase transition-all ${filterStatus === s ? 'bg-eg/20 text-eg' : 'text-white/40 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300 font-mono-custom">{error}</div>
      )}

      <div className="glass rounded-xl border border-eg/20 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="w-8 h-8 rounded-full border-2 border-eg/30 border-t-eg animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center font-mono-custom text-xs text-white/40">NO APPLICATIONS FOUND</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-eg/10 bg-dark-200/50 font-mono-custom text-[10px] text-white/50 uppercase tracking-widest">
                  <th className="py-3 px-4">APPLICANT</th>
                  <th className="py-3 px-4">PROFESSION</th>
                  <th className="py-3 px-4">AGE</th>
                  <th className="py-3 px-4 hidden md:table-cell">CURRENT ROLE</th>
                  <th className="py-3 px-4 hidden lg:table-cell">SKILLS</th>
                  <th className="py-3 px-4">DATE</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-eg/10">
                {filtered.map(app => (
                  <tr key={app.id} className="hover:bg-eg/5">
                    <td className="py-3 px-4 font-medium text-white">{app.full_name}</td>
                    <td className="py-3 px-4 text-white/60">{app.profession}</td>
                    <td className="py-3 px-4 text-white/60">{app.age}</td>
                    <td className="py-3 px-4 text-white/60 hidden md:table-cell">{app.applicant_role}</td>
                    <td className="py-3 px-4 text-white/50 hidden lg:table-cell truncate max-w-[140px]">{app.skills}</td>
                    <td className="py-3 px-4 text-white/40 font-mono-custom text-[10px]">{new Date(app.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span className={`font-mono-custom text-[10px] px-2 py-0.5 rounded border uppercase ${
                        app.status === 'pending' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                        app.status === 'approved' ? 'text-eg border-eg/30 bg-eg/10' :
                        'text-red-400 border-red-500/30 bg-red-500/10'
                      }`}>{app.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button onClick={() => setSelectedApp(app)} className="px-2 py-1 rounded border border-white/20 text-white/60 text-[10px] font-mono-custom hover:text-white">VIEW</button>
                      {app.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(app)} disabled={processing} className="px-2 py-1 rounded border border-eg/30 text-eg text-[10px] font-mono-custom hover:bg-eg/10">APPROVE</button>
                          <button onClick={() => { setSelectedApp(app); setShowRejectModal(true); }} disabled={processing} className="px-2 py-1 rounded border border-red-500/30 text-red-400 text-[10px] font-mono-custom hover:bg-red-500/10">REJECT</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      {selectedApp && !showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass rounded-2xl border border-eg/30 p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono-custom text-[10px] text-eg uppercase">APPLICATION DETAILS</p>
                <h3 className="font-display text-lg font-bold text-white">{selectedApp.full_name}</h3>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-white/40 hover:text-white">✕</button>
            </div>
            {[
              ['Profession', selectedApp.profession],
              ['Age', String(selectedApp.age)],
              ['Current Role', selectedApp.applicant_role],
              ['Bio', selectedApp.bio],
              ['Skills', selectedApp.skills],
              ['Education', selectedApp.education],
              ['Location', selectedApp.location],
              ['Motivation', selectedApp.motivation],
              ['Project Types', selectedApp.project_types],
              ['GitHub', selectedApp.github_url],
              ['Portfolio', selectedApp.portfolio_url],
              ['LinkedIn', selectedApp.linkedin_url],
              ['Other', selectedApp.other_url],
              ['Status', selectedApp.status],
              ['Rejection Reason', selectedApp.rejection_reason],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string} className="space-y-0.5">
                <p className="font-mono-custom text-[10px] text-white/40 uppercase">{label}</p>
                <p className="font-sans text-xs text-white/80 whitespace-pre-line">{value}</p>
              </div>
            ))}
            {selectedApp.status === 'pending' && (
              <div className="flex gap-3 pt-2 border-t border-eg/10">
                <button onClick={() => handleApprove(selectedApp)} disabled={processing} className="btn-primary py-2 px-4 text-xs flex-1">APPROVE</button>
                <button onClick={() => setShowRejectModal(true)} disabled={processing} className="flex-1 py-2 px-4 text-xs font-mono-custom rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10">REJECT</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-red-500/30 p-6 max-w-md w-full space-y-4">
            <h3 className="font-display text-sm font-bold text-white">Reject Application</h3>
            <p className="font-sans text-xs text-white/60">Rejecting {selectedApp.full_name}. Optional reason:</p>
            <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Optional rejection reason..." className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white font-sans" />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} className="text-xs text-white/50">CANCEL</button>
              <button onClick={handleReject} disabled={processing} className="px-4 py-2 rounded border border-red-500/50 text-red-300 text-xs font-mono-custom">{processing ? 'REJECTING...' : 'CONFIRM REJECT'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorApplicationsPanel;
