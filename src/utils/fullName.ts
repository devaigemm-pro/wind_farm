/**
 * Builds a display name from a profile's `name` and optional `last_name`.
 * `last_name` may be null/undefined → no trailing space is added.
 */
export function fullName(p: { name?: string | null; last_name?: string | null }): string {
  const name = p.name ?? '';
  return name + (p.last_name ? ' ' + p.last_name : '');
}
