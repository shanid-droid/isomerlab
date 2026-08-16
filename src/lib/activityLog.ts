import { supabase } from './supabase';

export type AuthLogAction =
  | 'user_login'
  | 'user_logout'
  | 'user_registered'
  | 'google_oauth_registration'
  | 'google_oauth_login'
  | 'failed_login';

interface AuthLogDetails {
  email?: string;
  provider?: string;
  method?: string;
}

/**
 * Log an authentication event via the secure server-side RPC.
 * Never sends passwords, tokens, or other secrets.
 */
export async function logAuthEvent(
  action: AuthLogAction,
  details: AuthLogDetails = {}
): Promise<void> {
  try {
    const safeDetails: AuthLogDetails = {};
    if (details.email) safeDetails.email = details.email.slice(0, 255);
    if (details.provider) safeDetails.provider = details.provider.slice(0, 50);
    if (details.method) safeDetails.method = details.method.slice(0, 50);

    await supabase.rpc('log_client_auth_event', {
      p_action: action,
      p_details: safeDetails,
    });
  } catch {
    // Non-fatal — audit logging must not block auth flows
  }
}

/** Returns true when a Supabase error is likely an RLS/permission denial */
export function isAccessDeniedError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === '42501' ||
    err.code === 'PGRST301' ||
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('not authorized')
  );
}

/** Generic message shown instead of raw Supabase errors */
export const ACCESS_DENIED_MESSAGE = 'You do not have permission to view this data.';

/** Human-readable sentence-case label for an activity log action */
export function formatActivityAction(action: string): string {
  const labels: Record<string, string> = {
    user_login: 'User login',
    user_logout: 'User logout',
    user_registered: 'User registered',
    google_oauth_registration: 'Google OAuth registration',
    google_oauth_login: 'Google OAuth login',
    failed_login: 'Failed login attempt',
    profile_created: 'Profile created',
    profile_updated: 'Profile updated',
    avatar_updated: 'Avatar updated',
    project_created: 'Project created',
    project_updated: 'Project updated',
    project_deleted: 'Project deleted',
    project_published: 'Project published',
    project_unpublished: 'Project unpublished',
    user_promoted_to_admin: 'User promoted to admin',
    user_demoted: 'User demoted',
    user_role_changed: 'User role changed',
    contact_form_submitted: 'New contact message received',
    contact_message_read: 'Contact message marked as read',
    contact_message_unread: 'Contact message marked as unread',
    contact_message_archived: 'Contact message archived',
    contact_message_deleted: 'Contact message deleted',
    contact_message_status_changed: 'Contact message status changed',
    creator_application_submitted: 'Creator application submitted',
    creator_application_approved: 'Creator application approved',
    creator_application_rejected: 'Creator application rejected',
    creator_project_uploaded: 'Creator project uploaded',
    creator_requirement_completed: 'Creator requirement completed',
    maintenance_mode_enabled: 'Maintenance mode enabled',
    maintenance_mode_disabled: 'Maintenance mode disabled',
    notification_created: 'Notification created',
    notification_updated: 'Notification updated',
    notification_deleted: 'Notification deleted',
    notification_read: 'Notification read',
    leaderboard_snapshot_generated: 'Leaderboard snapshot generated',
    leaderboard_published: 'Leaderboard snapshot published',
    leaderboard_unpublished: 'Leaderboard snapshot unpublished',
    leaderboard_settings_updated: 'Leaderboard settings updated',
    leaderboard_score_override: 'Leaderboard score override applied',
  };
  if (labels[action]) return labels[action];
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Predefined action groups for filtering */
export const ACTION_FILTER_GROUPS: { key: string; label: string; actions: string[] }[] = [
  { key: 'all', label: 'All actions', actions: [] },
  {
    key: 'auth',
    label: 'Authentication',
    actions: ['user_login', 'user_logout', 'user_registered', 'google_oauth_registration', 'google_oauth_login', 'failed_login'],
  },
  {
    key: 'profile',
    label: 'Profiles',
    actions: ['profile_created', 'profile_updated', 'avatar_updated'],
  },
  {
    key: 'project',
    label: 'Projects',
    actions: ['project_created', 'project_updated', 'project_deleted', 'project_published', 'project_unpublished'],
  },
  {
    key: 'admin',
    label: 'Admin',
    actions: ['user_promoted_to_admin', 'user_demoted', 'user_role_changed'],
  },
  {
    key: 'contact',
    label: 'Contact',
    actions: ['contact_form_submitted', 'contact_message_read', 'contact_message_unread', 'contact_message_archived', 'contact_message_deleted'],
  },
  {
    key: 'creator',
    label: 'Creator',
    actions: ['creator_application_submitted', 'creator_application_approved', 'creator_application_rejected', 'creator_project_uploaded', 'creator_requirement_completed'],
  },
  {
    key: 'leaderboard',
    label: 'Leaderboard',
    actions: ['leaderboard_snapshot_generated', 'leaderboard_published', 'leaderboard_unpublished', 'leaderboard_settings_updated', 'leaderboard_score_override'],
  },
  {
    key: 'system',
    label: 'System',
    actions: ['maintenance_mode_enabled', 'maintenance_mode_disabled'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    actions: ['notification_created', 'notification_updated', 'notification_deleted', 'notification_read'],
  },
];

/** Category filter for activity logs */
export type ActivityCategory = 'all' | 'auth' | 'profile' | 'project' | 'admin' | 'contact' | 'creator' | 'leaderboard' | 'system' | 'notifications';

export function getActivityCategory(action: string, targetType?: string | null): ActivityCategory {
  if (action.startsWith('user_') && (action.includes('login') || action.includes('logout') || action.includes('registered') || action.includes('oauth') || action.includes('failed'))) {
    return 'auth';
  }
  if (action.startsWith('profile_') || action === 'avatar_updated') return 'profile';
  if (action.startsWith('project_')) return 'project';
  if (action.includes('promoted') || action.includes('demoted') || action.includes('role_changed')) return 'admin';
  if (action.startsWith('contact_')) return 'contact';
  if (action.startsWith('creator_')) return 'creator';
  if (action.startsWith('leaderboard_')) return 'leaderboard';
  if (action.startsWith('maintenance_')) return 'system';
  if (action.startsWith('notification_')) return 'notifications';
  if (targetType === 'creator_application') return 'creator';
  if (targetType === 'leaderboard_snapshot' || targetType === 'leaderboard_settings' || targetType === 'leaderboard_entry') return 'leaderboard';
  if (targetType === 'site_settings') return 'system';
  if (targetType === 'auth') return 'auth';
  if (targetType === 'profile') return 'profile';
  if (targetType === 'project') return 'project';
  if (targetType === 'contact_message') return 'contact';
  return 'all';
}

/** Short summary line for an activity log entry */
export function formatActivitySummary(
  action: string,
  details: Record<string, unknown> = {}
): string {
  const email = details.email as string | undefined;
  const name = details.name as string | undefined;
  const title = details.title as string | undefined;
  const subject = details.subject as string | undefined;
  const fullName = details.full_name as string | undefined;
  const oldRole = details.old_role as string | undefined;
  const newRole = details.new_role as string | undefined;
  const lbType = details.type as string | undefined;
  const lbPeriod = details.period as string | undefined;

  switch (action) {
    case 'user_registered':
    case 'user_login':
    case 'google_oauth_registration':
    case 'google_oauth_login':
    case 'failed_login':
      return email ?? 'Unknown user';
    case 'profile_created':
    case 'profile_updated':
    case 'avatar_updated':
      return fullName ?? email ?? 'Unknown profile';
    case 'project_created':
    case 'project_updated':
    case 'project_deleted':
    case 'project_published':
    case 'project_unpublished':
      return title ? `Project: ${title}` : 'Project';
    case 'user_promoted_to_admin':
    case 'user_demoted':
    case 'user_role_changed':
      return email
        ? `${email} (${oldRole ?? '?'} → ${newRole ?? '?'})`
        : fullName ?? 'User role changed';
    case 'contact_form_submitted':
    case 'contact_message_read':
    case 'contact_message_archived':
    case 'contact_message_deleted':
      if (name && subject) return `From: ${name} — ${subject}`;
      if (email && subject) return `From: ${email} — ${subject}`;
      return name ?? email ?? 'Contact message';
    case 'creator_application_submitted':
    case 'creator_application_approved':
    case 'creator_application_rejected':
      return fullName ?? email ?? 'Creator application';
    case 'creator_project_uploaded':
    case 'creator_requirement_completed':
      return title ? `Project: ${title}` : fullName ?? 'Creator activity';
    case 'leaderboard_snapshot_generated':
      return `Generated ${lbType ?? 'leaderboard'} (${lbPeriod ?? 'all_time'})`;
    case 'leaderboard_published':
      return `Published ${lbType ?? 'leaderboard'} (${lbPeriod ?? 'all_time'})`;
    case 'leaderboard_unpublished':
      return `Unpublished ${lbType ?? 'leaderboard'} (${lbPeriod ?? 'all_time'})`;
    case 'leaderboard_settings_updated':
      return 'Leaderboard scoring settings updated';
    case 'leaderboard_score_override':
      return 'Leaderboard score manual override';
    case 'maintenance_mode_enabled':
    case 'maintenance_mode_disabled':
      return 'Site maintenance mode changed';
    default:
      return email ?? name ?? title ?? subject ?? '';
  }
}

/** Format a timestamp for display */
export function formatLogDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
