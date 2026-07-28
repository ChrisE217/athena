const STORAGE_KEY = 'athena.settings';

export interface AthenaSettings {
  rawFileNames: boolean;
}

export const DEFAULT_SETTINGS: AthenaSettings = {
  rawFileNames: false,
};

export function loadSettings(): AthenaSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AthenaSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / private mode
  }
}
