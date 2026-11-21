<script setup lang="ts">
import ProgramCompleteDialog from '@/components/dialogs/ProgramCompleteDialog.vue';
import AppHeader from '@/components/header/AppHeader.vue';
import DashboardLayout from '@/components/layout/DashboardLayout.vue';
import ProgramPanel from '@/components/program/ProgramPanel.vue';
import ResultsPanel from '@/components/results/ResultsPanel.vue';
import StablePanel from '@/components/stable/StablePanel.vue';
import RaceTrack from '@/components/track/RaceTrack.vue';
import type { ShortcutAction } from '@/composables/shortcuts';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useTheme } from '@/composables/useTheme';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';

const race = useRaceStore();
const preferences = usePreferencesStore();

useTheme(() => preferences.theme);

function dispatch(action: ShortcutAction): void {
  switch (action.type) {
    case 'togglePlayback':
      race.togglePlayback();
      break;
    case 'toggleFocus':
      preferences.toggleFocus();
      break;
    case 'toggleTheme':
      preferences.toggleTheme();
      break;
    case 'setSpeed':
      preferences.setSpeed(action.speed);
      break;
    case 'escape':
      preferences.escape();
      break;
    case 'confirmDialog':
      race.generateProgram();
      break;
    case 'dismissDialog':
      race.dismissCompletion();
      break;
    case 'block':
      break;
  }
}

useKeyboardShortcuts(() => ({ dialogOpen: race.completionOpen }), dispatch);
</script>

<template>
  <DashboardLayout>
    <template #header><AppHeader /></template>
    <template #track><RaceTrack /></template>
    <template #results><ResultsPanel /></template>
    <template #program><ProgramPanel /></template>
    <template #stable><StablePanel /></template>
  </DashboardLayout>
  <ProgramCompleteDialog />
</template>
