import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readStoredTheme,
  THEME_STORAGE_KEY,
  usePreferencesStore,
  writeStoredTheme,
} from './preferences';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('theme storage', () => {
  it('falls back to dark for missing, invalid or unavailable storage', () => {
    expect(readStoredTheme(null)).toBe('dark');
    expect(readStoredTheme({ getItem: () => null, setItem: () => undefined })).toBe('dark');
    expect(readStoredTheme({ getItem: () => 'purple', setItem: () => undefined })).toBe('dark');
    expect(readStoredTheme({ getItem: () => 'light', setItem: () => undefined })).toBe('light');
  });

  it('swallows storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(readStoredTheme(broken)).toBe('dark');
    expect(() => {
      writeStoredTheme(broken, 'light');
    }).not.toThrow();
  });
});

describe('usePreferencesStore', () => {
  it('starts dark at 1x with no focus or follow', () => {
    const prefs = usePreferencesStore();
    expect(prefs.theme).toBe('dark');
    expect(prefs.speed).toBe(1);
    expect(prefs.focusMode).toBe(false);
    expect(prefs.followedHorseId).toBeNull();
  });

  it('restores and persists the theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const prefs = usePreferencesStore();
    expect(prefs.theme).toBe('light');
    prefs.toggleTheme();
    expect(prefs.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('still toggles the theme when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const prefs = usePreferencesStore();
    prefs.toggleTheme();
    expect(prefs.theme).toBe('light');
  });

  it('accepts only supported speeds', () => {
    const prefs = usePreferencesStore();
    prefs.setSpeed(4);
    expect(prefs.speed).toBe(4);
    prefs.setSpeed(3);
    expect(prefs.speed).toBe(4);
  });

  it('toggles follow on the same horse and switches to another', () => {
    const prefs = usePreferencesStore();
    prefs.toggleFollow(5);
    expect(prefs.followedHorseId).toBe(5);
    prefs.toggleFollow(7);
    expect(prefs.followedHorseId).toBe(7);
    prefs.toggleFollow(7);
    expect(prefs.followedHorseId).toBeNull();
  });

  it('escape clears follow first, then focus mode, then does nothing', () => {
    const prefs = usePreferencesStore();
    prefs.toggleFocus();
    prefs.toggleFollow(3);
    expect(prefs.escape()).toBe(true);
    expect(prefs.followedHorseId).toBeNull();
    expect(prefs.focusMode).toBe(true);
    expect(prefs.escape()).toBe(true);
    expect(prefs.focusMode).toBe(false);
    expect(prefs.escape()).toBe(false);
  });
});
