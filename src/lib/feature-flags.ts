/**
 * Feature flags — simple system for gradual migration.
 * Dev: localStorage overrides allowed.
 * Prod: env var controls.
 */

interface FeatureFlags {
  newLayout: boolean;
}

const FLAGS_KEY = 'core-insight-flags';

function getDefaults(): FeatureFlags {
  return {
    newLayout: import.meta.env.VITE_FF_NEW_LAYOUT === 'true',
  };
}

function getLocalOverrides(): Partial<FeatureFlags> {
  try {
    const stored = localStorage.getItem(FLAGS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function getFeatureFlags(): FeatureFlags {
  const defaults = getDefaults();
  if (import.meta.env.PROD) return defaults;
  return { ...defaults, ...getLocalOverrides() };
}

export function setFeatureFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) {
  const overrides = getLocalOverrides();
  overrides[key] = value;
  localStorage.setItem(FLAGS_KEY, JSON.stringify(overrides));
  window.location.reload();
}

export function useFeatureFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
  return getFeatureFlags()[key];
}
