import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { HorseId } from '@/domain';
import { isPlaybackSpeed, type PlaybackSpeed } from '@/playback';
import type { Theme } from '@/render';

export const THEME_STORAGE_KEY = 'hr-theme';

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage, or null when it is unavailable (private mode, blocked, sandboxed). */
export function getThemeStorage(): ThemeStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Stored theme, falling back to dark on any missing, invalid or failing storage. */
export function readStoredTheme(storage: ThemeStorage | null): Theme {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return value === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Persists the theme; storage failures are ignored (the theme still applies for the session). */
export function writeStoredTheme(storage: ThemeStorage | null, theme: Theme): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Persisting is best-effort only.
  }
}

/** Viewer preferences: theme, playback speed, focus mode and the followed horse. */
export const usePreferencesStore = defineStore('preferences', () => {
  const theme = ref<Theme>(readStoredTheme(getThemeStorage()));
  const speed = ref<PlaybackSpeed>(1);
  const focusMode = ref(false);
  const followedHorseId = ref<HorseId | null>(null);

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    writeStoredTheme(getThemeStorage(), theme.value);
  }

  /** Sets the speed; unsupported values are ignored. */
  function setSpeed(value: number): void {
    if (isPlaybackSpeed(value)) speed.value = value;
  }

  function toggleFocus(): void {
    focusMode.value = !focusMode.value;
  }

  /** Follows a horse, or stops following it if it is already followed. */
  function toggleFollow(id: HorseId): void {
    followedHorseId.value = followedHorseId.value === id ? null : id;
  }

  function clearFollow(): void {
    followedHorseId.value = null;
  }

  /** Escape key: stop following first, then leave focus mode. Returns whether anything changed. */
  function escape(): boolean {
    if (followedHorseId.value !== null) {
      followedHorseId.value = null;
      return true;
    }
    if (focusMode.value) {
      focusMode.value = false;
      return true;
    }
    return false;
  }

  return {
    theme,
    speed,
    focusMode,
    followedHorseId,
    toggleTheme,
    setSpeed,
    toggleFocus,
    toggleFollow,
    clearFollow,
    escape,
  };
});
