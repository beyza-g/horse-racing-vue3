<script setup lang="ts">
import { useTheme } from '@/composables/useTheme';
import { usePreferencesStore } from '@/stores/preferences';
import RaceDashboardView from '@/views/RaceDashboardView.vue';

/** Root shell: applies app-wide concerns (the theme) and renders the page. */
const preferences = usePreferencesStore();

useTheme(() => preferences.theme);
</script>

<template>
  <RaceDashboardView />
</template>
