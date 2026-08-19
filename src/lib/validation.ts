const URL_REGEX = /^https?:\/\/.+\..+/i;

export function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return URL_REGEX.test(url.href);
  } catch {
    return false;
  }
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function fieldError(
  value: string,
  rules: { required?: boolean; minLength?: number; maxLength?: number; url?: boolean; email?: boolean }
): string | null {
  if (rules.required && !value.trim()) return 'This field is required.';
  if (rules.minLength && value.trim().length < rules.minLength) {
    return `Must be at least ${rules.minLength} characters.`;
  }
  if (rules.maxLength && value.trim().length > rules.maxLength) {
    return `Must be no more than ${rules.maxLength} characters.`;
  }
  if (rules.url && value.trim() && !isValidUrl(value)) return 'Please enter a valid URL.';
  if (rules.email && value.trim() && !validateEmail(value)) return 'Please enter a valid email.';
  return null;
}
