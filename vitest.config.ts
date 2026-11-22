import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

/**
 * Two Vitest projects:
 * - `core`: pure engine, playback, view models and render geometry, run in plain Node
 *   so any accidental DOM dependency fails loudly.
 * - `ui`: stores, composables, components, layouts and views, run in jsdom.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,vue}'],
        exclude: [
          'src/**/*.spec.ts',
          'src/**/__fixtures__/**',
          'src/test/**',
          'src/main.ts',
          'src/**/*.d.ts',
        ],
      },
      projects: [
        {
          extends: true,
          test: {
            name: 'core',
            environment: 'node',
            include: ['src/{domain,playback,viewModels,render}/**/*.spec.ts'],
            exclude: ['src/**/*.dom.spec.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'ui',
            environment: 'jsdom',
            setupFiles: ['src/test/setup.ts'],
            include: [
              'src/{stores,composables,components,layouts,views}/**/*.spec.ts',
              'src/**/*.dom.spec.ts',
              'src/*.spec.ts',
            ],
          },
        },
      ],
    },
  }),
);
