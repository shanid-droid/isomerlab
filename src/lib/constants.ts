/** Hardcoded system owner UUID — matches public.is_owner() in Supabase */
export const OWNER_ID = '9d5d6287-1843-4cd0-afee-fc1830411571';

/** Default maintenance message shown when none is configured */
export const DEFAULT_MAINTENANCE_MESSAGE =
  'ISOMER LAB is currently under maintenance.';

export const DEFAULT_MAINTENANCE_SUBMESSAGE =
  "Something better is being built. Please check back soon.";

/** Routes always accessible during maintenance (exact match) */
export const MAINTENANCE_EXEMPT_PATHS = ['/', '/admin/login', '/auth/callback'] as const;

/** Creator must upload first project within this many days of approval */
export const CREATOR_REQUIREMENT_DAYS = 2;
