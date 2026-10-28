/**
 * Local settings: defaults come from playground_config.json (exported from
 * Google AI Studio); user changes are persisted in localStorage.
 */
import defaults from './playground_config.json';

const STORAGE_KEY = 'reversi.settings.v1';

type SettingValue = number | boolean | string;

function readStored(): Record<string, SettingValue> {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Defaults merged with any values the player saved on this device. */
export function loadSettings(): Record<string, SettingValue> {
  return {...(defaults.values as Record<string, SettingValue>), ...readStored()};
}

export function saveSetting(key: string, value: SettingValue): void {
  try {
    const next = {...readStored(), [key]: value};
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode etc.): settings just won't persist.
  }
}
