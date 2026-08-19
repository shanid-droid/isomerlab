import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { CreatorApplication } from '../../lib/types';

interface CreatorApplicationsPanelProps {
  isOwner: boolean;
}

function calculateAge(dobStr?: string | null, legacyAge?: number | null): number | null {
  if (dobStr) {
    const dob = new Date(dobStr);
    if (!isNaN(dob.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      return age >= 0 ? age : null;
    }
  }
  return legacyAge ?? null;
}

function formatDateDisplay(dobStr?: string | null): string {
  if (!dobStr) return 'N/A';
  const parts = dobStr.split('-');
  if (parts.length !== 3) return dobStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const CreatorApplicationsPanel: React.FC<CreatorApplicationsPanelProps> = () => {
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<CreatorApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

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

  const handleApprove = async () => {
    if (!selectedApp) return;
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('review_creator_application', {
        p_application_id: selectedApp.id,
        p_action: 'approve',
      });
      if (error) throw error;
      setShowApproveModal(false);
      setSelectedApp(null);
      await fetchApplications();
      showToast('Application approved successfully.');
    } catch (err: unknown) {
      showToast((err as Error)?.message ?? 'Failed to approve application', 'error');
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
      showToast('Application rejected.', 'error');
    } catch (err: unknown) {
      showToast((err as Error)?.message ?? 'Failed to reject application', 'error');
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

      {toastMsg && (
        <div className={`p-4 rounded-xl border font-mono-custom text-xs flex items-center justify-between gap-3 animate-fade-in ${
          toastMsg.type === 'success'
            ? 'border-eg/40 bg-eg/10 text-eg'
            : 'border-red-500/40 bg-red-500/10 text-red-300'
        }`}>
          <span>{toastMsg.type === 'success' ? '✓ ' : '✕ '}{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="text-white/40 hover:text-white text-xs">✕</button>
        </div>
      )}

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
                  <th className="py-3 px-4">DOB / AGE</th>
                  <th className="py-3 px-4 hidden md:table-cell">ROLE</th>
                  <th className="py-3 px-4 hidden lg:table-cell">SKILLS</th>
                  <th className="py-3 px-4">DATE</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-eg/10">
                {filtered.map(app => {
                  const ageVal = calculateAge(app.date_of_birth, app.age);
                  return (
                    <tr key={app.id} className="hover:bg-eg/5">
                      <td className="py-3 px-4 font-medium text-white">{app.full_name}</td>
                      <td className="py-3 px-4 text-white/60">{app.profession}</td>
                      <td className="py-3 px-4 text-white/60 font-mono-custom text-[11px]">
                        {app.date_of_birth ? formatDateDisplay(app.date_of_birth) : 'N/A'}
                        {ageVal !== null && <span className="text-white/40 ml-1">({ageVal}y)</span>}
                      </td>
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
                            <button onClick={() => { setSelectedApp(app); setShowApproveModal(true); }} disabled={processing} className="px-2 py-1 rounded border border-eg/30 text-eg text-[10px] font-mono-custom hover:bg-eg/10">APPROVE</button>
                            <button onClick={() => { setSelectedApp(app); setShowRejectModal(true); }} disabled={processing} className="px-2 py-1 rounded border border-red-500/30 text-red-400 text-[10px] font-mono-custom hover:bg-red-500/10">REJECT</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal — Structured Section View */}
      {selectedApp && !showRejectModal && !showApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass rounded-2xl border border-eg/30 p-6 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-start border-b border-eg/10 pb-3">
              <div>
                <p className="font-mono-custom text-[10px] text-eg uppercase tracking-widest">CREATOR APPLICATION REVIEW</p>
                <h3 className="font-display text-xl font-bold text-white mt-1">{selectedApp.full_name}</h3>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-white/40 hover:text-white text-lg">✕</button>
            </div>

            {/* 1. Personal Information */}
            <div className="space-y-2 bg-dark-200/50 p-4 rounded-xl border border-white/5">
              <p className="font-mono-custom text-[10px] text-eg uppercase tracking-wider font-semibold">1. Personal Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div><span className="text-white/40">Date of Birth: </span><span className="text-white font-mono-custom">{selectedApp.date_of_birth ? formatDateDisplay(selectedApp.date_of_birth) : 'N/A'}</span></div>
                <div><span className="text-white/40">Calculated Age: </span><span className="text-white font-mono-custom">{calculateAge(selectedApp.date_of_birth, selectedApp.age) !== null ? `${calculateAge(selectedApp.date_of_birth, selectedApp.age)} years` : 'N/A'}</span></div>
                <div><span className="text-white/40">Location: </span><span className="text-white">{selectedApp.location || 'Not provided'}</span></div>
              </div>
            </div>

            {/* 2. Professional Information */}
            <div className="space-y-2 bg-dark-200/50 p-4 rounded-xl border border-white/5">
              <p className="font-mono-custom text-[10px] text-eg uppercase tracking-wider font-semibold">2. Professional Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div><span className="text-white/40">Profession: </span><span className="text-white">{selectedApp.profession}</span></div>
                <div><span className="text-white/40">Current Role: </span><span className="text-white">{selectedApp.applicant_role}</span></div>
                <div><span className="text-white/40">Education: </span><span className="text-white">{selectedApp.education || 'N/A'}</span></div>
                <div><span className="text-white/40">Experience Level: </span><span className="text-white">{selectedApp.experience_level || 'N/A'}</span></div>
                {selectedApp.education_details && (
                  <div className="sm:col-span-2"><span className="text-white/40">Education Details: </span><span className="text-white/80">{selectedApp.education_details}</span></div>
                )}
              </div>
            </div>

            {/* 3. Skills & Project Types */}
            <div className="space-y-3 bg-dark-200/50 p-4 rounded-xl border border-white/5">
              <p className="font-mono-custom text-[10px] text-eg uppercase tracking-wider font-semibold">3. Skills & Project Types</p>
              <div>
                <p className="text-[10px] text-white/40 uppercase mb-1 font-mono-custom">Primary Skills:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedApp.skills || '').split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} className="px-2.5 py-0.5 rounded bg-eg/10 border border-eg/20 text-eg text-[11px] font-mono-custom">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase mb-1 font-mono-custom">Project Types:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedApp.project_types || '').split(',').map(p => p.trim()).filter(Boolean).map(p => (
                    <span key={p} className="px-2.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[11px] font-mono-custom">{p}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Online Links */}
            <div className="space-y-2 bg-dark-200/50 p-4 rounded-xl border border-white/5 text-xs">
              <p className="font-mono-custom text-[10px] text-eg uppercase tracking-wider font-semibold">4. Online Links</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedApp.github_url && <div><span className="text-white/40">GitHub: </span><a href={selectedApp.github_url} target="_blank" rel="noreferrer" className="text-eg hover:underline truncate inline-block max-w-full">{selectedApp.github_url}</a></div>}
                {selectedApp.portfolio_url && <div><span className="text-white/40">Portfolio: </span><a href={selectedApp.portfolio_url} target="_blank" rel="noreferrer" className="text-eg hover:underline truncate inline-block max-w-full">{selectedApp.portfolio_url}</a></div>}
                {selectedApp.linkedin_url && <div><span className="text-white/40">LinkedIn: </span><a href={selectedApp.linkedin_url} target="_blank" rel="noreferrer" className="text-eg hover:underline truncate inline-block max-w-full">{selectedApp.linkedin_url}</a></div>}
                {selectedApp.other_url && <div><span className="text-white/40">Other: </span><a href={selectedApp.other_url} target="_blank" rel="noreferrer" className="text-eg hover:underline truncate inline-block max-w-full">{selectedApp.other_url}</a></div>}
              </div>
            </div>

            {/* 5. Statements */}
            <div className="space-y-3 bg-dark-200/50 p-4 rounded-xl border border-white/5">
              <p className="font-mono-custom text-[10px] text-eg uppercase tracking-wider font-semibold">5. Statements</p>
              <div>
                <p className="text-[10px] text-white/40 uppercase mb-1 font-mono-custom">Bio:</p>
                <p className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed">{selectedApp.bio}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase mb-1 font-mono-custom">Motivation:</p>
                <p className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed">{selectedApp.motivation}</p>
              </div>
            </div>

            {selectedApp.status === 'pending' && (
              <div className="flex gap-3 pt-2 border-t border-eg/10">
                <button onClick={() => setShowApproveModal(true)} disabled={processing} className="btn-primary py-2.5 px-4 text-xs flex-1 font-mono-custom">APPROVE APPLICATION</button>
                <button onClick={() => setShowRejectModal(true)} disabled={processing} className="flex-1 py-2.5 px-4 text-xs font-mono-custom rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10">REJECT</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {showApproveModal && selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-eg/40 p-6 max-w-md w-full space-y-4">
            <h3 className="font-display text-sm font-bold text-white">Approve Creator Application</h3>
            <p className="font-sans text-xs text-white/70">
              Are you sure you want to approve <strong className="text-white">{selectedApp.full_name}</strong> as an official ISOMER Creator? They will receive full creator publishing access.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowApproveModal(false)} disabled={processing} className="px-4 py-2 rounded-xl border border-white/15 text-xs text-white/60 font-mono-custom hover:text-white">
                CANCEL
              </button>
              <button onClick={handleApprove} disabled={processing} className="btn-primary px-4 py-2 text-xs font-mono-custom flex items-center gap-2">
                {processing && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
                {processing ? 'APPROVING...' : 'CONFIRM APPROVAL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-red-500/30 p-6 max-w-md w-full space-y-4">
            <h3 className="font-display text-sm font-bold text-white">Reject Application</h3>
            <p className="font-sans text-xs text-white/60">Rejecting application for {selectedApp.full_name}. Optional reason for feedback:</p>
            <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Optional rejection reason..." className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white font-sans focus:outline-none focus:border-red-400" />
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} disabled={processing} className="px-4 py-2 rounded-xl border border-white/15 text-xs text-white/60 font-mono-custom hover:text-white">
                CANCEL
              </button>
              <button onClick={handleReject} disabled={processing} className="px-4 py-2 rounded-xl border border-red-500/50 bg-red-500/20 text-red-300 text-xs font-mono-custom hover:bg-red-500/30">
                {processing ? 'REJECTING...' : 'CONFIRM REJECT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorApplicationsPanel;
