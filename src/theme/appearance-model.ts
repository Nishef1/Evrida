export type AppearancePreference = 'system' | 'light' | 'dark';
export function parseAppearancePreference(value: unknown): AppearancePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function resolveAppearance(preference: AppearancePreference, system: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  return preference === 'system' ? system === 'dark' ? 'dark' : 'light' : preference;
}
