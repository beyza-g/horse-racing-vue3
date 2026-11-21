import { watchEffect } from 'vue';
import type { Theme } from '@/render';

/** Mirrors the theme onto `<html data-theme>`, where the CSS tokens read it. */
export function useTheme(theme: () => Theme): void {
  watchEffect(() => {
    document.documentElement.dataset['theme'] = theme();
  });
}
