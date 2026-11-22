// @ts-check
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

/** Globals that make code impure (time, randomness, browser host). */
const IMPURE_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'performance',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'Date',
].map((name) => ({
  name,
  message: 'Pure layers receive time and randomness from the caller (dt / injected Rng).',
}));

const IMPURE_PROPERTIES = [
  { object: 'Math', property: 'random', message: 'Use the injected seeded Rng instead.' },
  { object: 'Date', property: 'now', message: 'Receive time from the caller instead.' },
  { object: 'performance', property: 'now', message: 'Receive time from the caller instead.' },
];

/** Builds a no-restricted-imports rule that bans framework and outer-layer imports. */
const forbidLayers = (/** @type {string[]} */ layers, /** @type {string} */ reason) => [
  'error',
  {
    patterns: [
      { group: ['vue', 'pinia', '@vue/*'], message: reason },
      ...layers.map((layer) => ({
        group: [`@/${layer}`, `@/${layer}/**`, `**/${layer}/**`],
        message: reason,
      })),
    ],
  },
];

export default defineConfigWithVueTs(
  {
    name: 'app/ignores',
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.strictTypeChecked,
  comments.recommended,
  {
    name: 'app/general',
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // `any` is banned. A justified exception needs an inline disable with a `-- reason`.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: true },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/define-macros-order': 'error',
      'vue/multi-word-component-names': ['error', { ignores: ['App'] }],
      'vue/no-unused-refs': 'error',
      'vue/require-typed-ref': 'error',
    },
  },
  {
    name: 'app/layer-domain',
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...IMPURE_GLOBALS],
      'no-restricted-properties': ['error', ...IMPURE_PROPERTIES],
      'no-restricted-imports': forbidLayers(
        [
          'playback',
          'viewModels',
          'render',
          'stores',
          'composables',
          'components',
          'layouts',
          'views',
        ],
        'The domain layer is pure: it may not depend on frameworks or outer layers.',
      ),
    },
  },
  {
    name: 'app/layer-playback',
    files: ['src/playback/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...IMPURE_GLOBALS],
      'no-restricted-properties': ['error', ...IMPURE_PROPERTIES],
      'no-restricted-imports': forbidLayers(
        ['viewModels', 'render', 'stores', 'composables', 'components', 'layouts', 'views'],
        'The playback layer is pure: it may only depend on the domain layer.',
      ),
    },
  },
  {
    name: 'app/layer-view-models',
    files: ['src/viewModels/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...IMPURE_GLOBALS],
      'no-restricted-properties': ['error', ...IMPURE_PROPERTIES],
      'no-restricted-imports': forbidLayers(
        ['render', 'stores', 'composables', 'components', 'layouts', 'views'],
        'View models are pure display rules: they may only depend on domain and playback.',
      ),
    },
  },
  {
    name: 'app/layer-render',
    files: ['src/render/**/*.ts'],
    rules: {
      'no-restricted-imports': forbidLayers(
        ['viewModels', 'stores', 'composables', 'components', 'layouts', 'views'],
        'The render layer draws snapshots; it may not depend on Vue, Pinia or components.',
      ),
    },
  },
  {
    name: 'app/layer-stores',
    files: ['src/stores/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/**', '@/layouts/**', '@/views/**'],
              message: 'Stores must not depend on components, layouts or views.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'app/layer-components',
    files: ['src/components/**/*.{ts,vue}', 'src/layouts/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/views/**'],
              message: 'Components and layouts are composed by views, never the reverse.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'app/tests',
    files: ['**/*.spec.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    name: 'app/node-config',
    files: ['*.config.{js,ts}', 'scripts/**/*.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  skipFormatting,
);
