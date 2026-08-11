import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { isAccessDeniedError } from '../../lib/activityLog';
import ActivityLogsPanel from './ActivityLogsPanel';

interface OwnerOverviewProps {
  projectCount: number;
  onNavigateToInbox: () => void;
  onNavigateToActivity: () => void;
}

interface OverviewStats {
  unreadMessages: number;
  totalMessages: number;
  registeredUsers: number;
  totalProjects: number;
}

const OwnerOverview: React.FC<OwnerOverviewProps> = ({
  projectCount,
  onNavigateToInbox,
  onNavigateToActivity,
}) => {
  const [stats, setStats] = useState<OverviewStats>({
    unreadMessages: 0,
    totalMessages: 0,
    registeredUsers: 0,
    totalProjects: projectCount,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [messagesRes, usersRes, projectsRes] = await Promise.all([
        supabase.from('contact_messages').select('status'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
      ]);

      const messages = messagesRes.error && isAccessDeniedError(messagesRes.error)
        ? []
        : (messagesRes.data ?? []);
      setStats({
        unreadMessages: messages.filter(m => m.status === 'unread').length,
        totalMessages: messages.length,
        registeredUsers: usersRes.count ?? 0,
        totalProjects: projectsRes.count ?? projectCount,
      });
    } catch {
      // Non-fatal — show partial stats
    } finally {
      setLoading(false);
    }
  }, [projectCount]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = [
    {
      label: 'UNREAD MESSAGES',
      value: stats.unreadMessages,
      accent: 'text-eg text-glow-sm',
      glow: 'bg-eg/10',
      onClick: onNavigateToInbox,
    },
    {
      label: 'TOTAL MESSAGES',
      value: stats.totalMessages,
      accent: 'text-white',
      glow: 'bg-eg/5',
      onClick: onNavigateToInbox,
    },
    {
      label: 'REGISTERED USERS',
      value: stats.registeredUsers,
      accent: 'text-white',
      glow: 'bg-purple-500/10',
    },
    {
      label: 'TOTAL PROJECTS',
      value: stats.totalProjects,
      accent: 'text-white',
      glow: 'bg-blue-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <button
            key={card.label}
            onClick={card.onClick}
            disabled={!card.onClick}
            className={`glass rounded-xl p-5 border border-eg/15 relative overflow-hidden text-left transition-all ${
              card.onClick ? 'hover:border-eg/30 hover:shadow-eg-sm cursor-pointer' : 'cursor-default'
            }`}
          >
            <div className={`absolute top-0 right-0 w-16 h-16 ${card.glow} rounded-bl-full pointer-events-none`} />
            <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">
              {card.label}
            </p>
            {loading ? (
              <div className="h-9 w-16 bg-white/10 rounded animate-pulse" />
            ) : (
              <p className={`font-display text-3xl font-bold ${card.accent}`}>{card.value}</p>
            )}
          </button>
        ))}
      </div>

      {/* Recent activity */}
      <div className="glass rounded-xl p-6 border border-eg/20">
        <ActivityLogsPanel
          limit={10}
          compact
          onViewAll={onNavigateToActivity}
        />
      </div>
    </div>
  );
};

export default OwnerOverview;
