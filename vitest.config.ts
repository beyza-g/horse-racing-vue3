import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

/**
 * Two Vitest projects:
 * - `core`: pure engine, playback and render geometry, run in plain Node
 *   so any accidental DOM dependency fails loudly.
 * - `ui`: stores, composables and components, run in jsdom.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,vue}'],
        exclude: ['src/**/*.spec.ts', 'src/**/__fixtures__/**', 'src/main.ts', 'src/**/*.d.ts'],
      },
      projects: [
        {
          extends: true,
          test: {
            name: 'core',
            environment: 'node',
            include: ['src/{domain,playback,render}/**/*.spec.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'ui',
            environment: 'jsdom',
            include: ['src/{stores,composables,components}/**/*.spec.ts', 'src/*.spec.ts'],
          },
        },
      ],
    },
  }),
);
