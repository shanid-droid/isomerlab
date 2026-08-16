import type { UserProfile, UserRole } from './types';
import { OWNER_ID } from './constants';

export { OWNER_ID };

/**
 * Centralized Role Resolver
 * Priority Order:
 * 1. OWNER (Always if userId === OWNER_ID or role === 'owner')
 * 2. ADMIN
 * 3. CREATOR
 * 4. USER
 */
export function resolveUserRole(
  userId: string | null | undefined,
  profileRole: UserRole | string | null | undefined
): UserRole {
  if (userId === OWNER_ID) {
    return 'owner';
  }
  if (profileRole === 'owner') {
    return 'owner';
  }
  if (profileRole === 'admin') {
    return 'admin';
  }
  if (profileRole === 'creator') {
    return 'creator';
  }
  return 'user';
}

export function isOwner(profileOrId: Pick<UserProfile, 'id'> | string | null | undefined): boolean {
  if (!profileOrId) return false;
  if (typeof profileOrId === 'string') return profileOrId === OWNER_ID;
  return profileOrId.id === OWNER_ID;
}

export function isAdminRole(role: UserRole | string | null | undefined, userId?: string | null): boolean {
  if (userId === OWNER_ID) return true;
  const effective = resolveUserRole(userId, role);
  return effective === 'owner' || effective === 'admin';
}

export function isCreatorRole(role: UserRole | string | null | undefined, userId?: string | null): boolean {
  if (userId === OWNER_ID) return true;
  const effective = resolveUserRole(userId, role);
  return effective === 'owner' || effective === 'admin' || effective === 'creator';
}

export function isNormalUser(role: UserRole | string | null | undefined, userId?: string | null): boolean {
  if (userId === OWNER_ID) return false;
  const effective = resolveUserRole(userId, role);
  return effective === 'user';
}

/** Normalize a raw DB role string */
export function normalizeUserRole(role: string | null | undefined, userId?: string | null): UserRole {
  return resolveUserRole(userId, role);
}

/** Uppercase display label for role */
export function formatRoleLabel(
  role: UserRole | string | null | undefined,
  userId?: string | null
): string {
  const effective = resolveUserRole(userId, role);
  switch (effective) {
    case 'owner':
      return 'OWNER';
    case 'admin':
      return 'ADMIN';
    case 'creator':
      return 'CREATOR';
    case 'user':
    default:
      return 'USER';
  }
}

/** Tailwind classes for role badge styling in admin & dashboard UI */
export function getRoleBadgeClasses(
  role: UserRole | string | null | undefined,
  userId?: string | null
): string {
  const effective = resolveUserRole(userId, role);
  switch (effective) {
    case 'owner':
      return 'bg-eg/15 border-eg/50 text-eg font-bold shadow-eg-sm';
    case 'admin':
      return 'bg-eg/10 border-eg/40 text-eg font-semibold';
    case 'creator':
      return 'bg-purple-500/10 border-purple-500/30 text-purple-400 font-semibold';
    case 'user':
    default:
      return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
  }
}

/** Admin console access (Owner & Admin) */
export function canAccessAdminConsole(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return isOwner(profile) || isAdminRole(profile.role, profile.id);
}

/** Creator dashboard access (Owner, Admin, & Creator) */
export function canAccessCreatorDashboard(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return isOwner(profile) || isCreatorRole(profile.role, profile.id);
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
  return (isOwner(profile) || isAdminRole(profile?.role, profile?.id)) && pathname.startsWith('/admin');
}

export function getPostLoginPath(role: UserRole | null | undefined, userId?: string): string {
  if (userId === OWNER_ID || role === 'owner' || role === 'admin') return '/admin';
  if (role === 'creator') return '/creator';
  return '/dashboard';
}
