import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ActivityLog } from '../../lib/types';
import {
  ACCESS_DENIED_MESSAGE,
  ACTION_FILTER_GROUPS,
  formatActivityAction,
  formatActivitySummary,
  formatLogDate,
  isAccessDeniedError,
} from '../../lib/activityLog';

const PAGE_SIZE = 25;

interface ActivityLogsPanelProps {
  limit?: number;
  compact?: boolean;
  onViewAll?: () => void;
}

type SortOrder = 'newest' | 'oldest';

const ActivityLogsPanel: React.FC<ActivityLogsPanelProps> = ({
  limit,
  compact = false,
  onViewAll,
}) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async (append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const offset = append ? logs.length : 0;
      const fetchLimit = limit ?? PAGE_SIZE;

      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: sortOrder === 'oldest' });

      if (limit) {
        query = query.limit(limit);
      } else {
        query = query.range(offset, offset + fetchLimit - 1);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        if (isAccessDeniedError(fetchError)) {
          setError(ACCESS_DENIED_MESSAGE);
          setLogs([]);
          setHasMore(false);
          return;
        }
        throw fetchError;
      }

      const rows = (data as ActivityLog[]) ?? [];

      if (append) {
        setLogs(prev => [...prev, ...rows]);
      } else {
        setLogs(rows);
      }

      if (!limit) {
        setHasMore(rows.length === fetchLimit);
      }
    } catch {
      setError('Unable to load activity logs. Please try again.');
      if (!append) setLogs([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limit, logs.length, sortOrder]);

  useEffect(() => {
    if (!compact) {
      setLogs([]);
      setHasMore(true);
    }
    fetchLogs(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOrder, limit, compact]);

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    const group = ACTION_FILTER_GROUPS.find(g => g.key === actionFilter);
    if (group && group.key !== 'all') {
      result = result.filter(l => group.actions.includes(l.action));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => {
        const details = (l.details ?? {}) as Record<string, unknown>;
        const summary = formatActivitySummary(l.action, details);
        const description = formatActivityAction(l.action);
        return (
          l.action.toLowerCase().includes(q) ||
          description.toLowerCase().includes(q) ||
          summary.toLowerCase().includes(q) ||
          (l.target_type?.toLowerCase().includes(q) ?? false) ||
          (l.actor_user_id?.toLowerCase().includes(q) ?? false) ||
          JSON.stringify(details).toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [logs, actionFilter, searchQuery]);

  const categoryDot = (action: string) => {
    const group = ACTION_FILTER_GROUPS.find(
      g => g.key !== 'all' && g.actions.includes(action)
    );
    const colors: Record<string, string> = {
      auth: 'bg-blue-400',
      profile: 'bg-purple-400',
      project: 'bg-eg',
      admin: 'bg-amber-400',
      contact: 'bg-cyan-400',
    };
    const color = group ? colors[group.key] ?? 'bg-white/40' : 'bg-white/40';
    return (
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color} shadow-[0_0_6px_currentColor]`} />
    );
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase">
            Recent Activity
          </p>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="font-mono-custom text-[10px] text-eg hover:text-eg/80 transition-colors"
            >
              View all logs →
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="font-mono-custom text-xs text-white/30">{error}</p>
        ) : filteredLogs.length === 0 ? (
          <p className="font-mono-custom text-xs text-white/30">No recent activity.</p>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map(log => {
              const details = (log.details ?? {}) as Record<string, unknown>;
              return (
                <div key={log.id} className="flex items-start gap-3 py-2 border-b border-eg/5 last:border-0">
                  {categoryDot(log.action)}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono-custom text-[11px] text-white/80 truncate">
                      {formatActivityAction(log.action)}
                    </p>
                    {formatActivitySummary(log.action, details) && (
                      <p className="font-sans text-[10px] text-white/40 truncate">
                        {formatActivitySummary(log.action, details)}
                      </p>
                    )}
                  </div>
                  <p className="font-mono-custom text-[9px] text-white/25 flex-shrink-0">
                    {formatLogDate(log.created_at).split(',')[0]}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6 border border-eg/20 flex flex-col md:flex-row items-stretch md:items-center gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 font-mono-custom focus:outline-none focus:border-eg"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="bg-dark-200/80 border border-eg/20 rounded-xl px-3 py-2.5 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
        >
          {ACTION_FILTER_GROUPS.map(g => (
            <option key={g.key} value={g.key}>{g.label}</option>
          ))}
        </select>

        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value as SortOrder)}
          className="bg-dark-200/80 border border-eg/20 rounded-xl px-3 py-2.5 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 flex items-center justify-between">
          <p className="font-mono-custom text-xs text-red-300">{error}</p>
          {!error.includes('permission') && (
            <button onClick={() => fetchLogs(false)} className="btn-primary text-[10px] py-1 px-3">
              RETRY
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase">
          ACTIVITY LOG ({filteredLogs.length})
        </p>

        {loading ? (
          <div className="glass rounded-xl p-8 border border-eg/10 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-eg/30 border-t-eg animate-spin mx-auto mb-3" />
            <p className="font-mono-custom text-xs text-white/40">Loading activity logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="glass rounded-xl p-8 border border-eg/10 text-center">
            <p className="font-mono-custom text-xs text-white/40">No activity logs found.</p>
          </div>
        ) : (
          <>
            {filteredLogs.map(log => {
              const details = (log.details ?? {}) as Record<string, unknown>;
              const summary = formatActivitySummary(log.action, details);
              return (
                <div
                  key={log.id}
                  className="glass rounded-xl p-5 border border-eg/10 hover:border-eg/20 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{categoryDot(log.action)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <p className="font-display text-xs tracking-wider text-white">
                          {formatActivityAction(log.action)}
                        </p>
                        <p className="font-mono-custom text-[10px] text-white/30 flex-shrink-0">
                          {formatLogDate(log.created_at)}
                        </p>
                      </div>

                      {summary && (
                        <p className="font-sans text-sm text-eg/80 mb-2">{summary}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                        <span className="font-mono-custom text-[9px] text-white/30 uppercase tracking-wider">
                          Action: {log.action}
                        </span>
                        {log.actor_user_id && (
                          <span className="font-mono-custom text-[9px] text-white/30 uppercase tracking-wider">
                            Actor: {log.actor_user_id.slice(0, 8)}…
                          </span>
                        )}
                        {log.target_type && (
                          <span className="font-mono-custom text-[9px] text-white/30 uppercase tracking-wider">
                            Target: {log.target_type}
                            {log.target_id ? ` · ${log.target_id.slice(0, 8)}…` : ''}
                          </span>
                        )}
                      </div>

                      {Object.keys(details).length > 0 && (
                        <details className="mt-3">
                          <summary className="font-mono-custom text-[9px] text-white/25 cursor-pointer hover:text-white/40 uppercase tracking-wider">
                            Details
                          </summary>
                          <pre className="mt-2 p-3 rounded-lg bg-dark-200/60 border border-eg/10 font-mono-custom text-[10px] text-white/50 overflow-x-auto">
                            {JSON.stringify(details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMore && !limit && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => fetchLogs(true)}
                  disabled={loadingMore}
                  className="btn-primary py-2 px-6 text-xs disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityLogsPanel;
