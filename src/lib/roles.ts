import type { UserProfile, UserRole } from './types';
import { OWNER_ID } from './constants';

export function isOwner(profile: Pick<UserProfile, 'id'> | null | undefined): boolean {
  return profile?.id === OWNER_ID;
}

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function isCreatorRole(role: UserRole | null | undefined): boolean {
  return role === 'creator';
}

export function isNormalUser(role: UserRole | null | undefined): boolean {
  return role === 'user' || !role;
}

/** Normalize a raw DB role string — never collapse creator/admin into user. */
export function normalizeUserRole(role: string | null | undefined): UserRole {
  if (role === 'admin' || role === 'creator' || role === 'user') {
    return role;
  }
  return 'user';
}

/** Uppercase display label for profiles.role */
export function formatRoleLabel(role: UserRole | string | null | undefined): string {
  switch (normalizeUserRole(role ?? undefined)) {
    case 'admin':
      return 'ADMIN';
    case 'creator':
      return 'CREATOR';
    case 'user':
    default:
      return 'USER';
  }
}

/** Tailwind classes for role badge styling in admin UI */
export function getRoleBadgeClasses(role: UserRole | string | null | undefined): string {
  switch (normalizeUserRole(role ?? undefined)) {
    case 'admin':
      return 'bg-eg/10 border-eg/40 text-eg';
    case 'creator':
      return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
    case 'user':
    default:
      return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
  }
}

/** Admin console access (owner has role=admin) */
export function canAccessAdminConsole(profile: UserProfile | null | undefined): boolean {
  return isAdminRole(profile?.role);
}

/** Creator dashboard access */
export function canAccessCreatorDashboard(profile: UserProfile | null | undefined): boolean {
  return isCreatorRole(profile?.role);
}

/** Owner bypasses maintenance mode entirely */
export function bypassesMaintenance(profile: UserProfile | null | undefined): boolean {
  return isOwner(profile);
}

/** Admin can access /admin routes during maintenance */
export function canAccessAdminDuringMaintenance(
  profile: UserProfile | null | undefined,
  pathname: string
): boolean {
  return isAdminRole(profile?.role) && pathname.startsWith('/admin');
}

export function getPostLoginPath(role: UserRole | null | undefined, userId?: string): string {
  if (userId === OWNER_ID || role === 'admin') return '/admin';
  if (role === 'creator') return '/creator';
  return '/dashboard';
}
