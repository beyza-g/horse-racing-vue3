<script setup lang="ts">
import ProgramCompleteDialog from '@/components/dialogs/ProgramCompleteDialog.vue';
import RegenerateConfirmDialog from '@/components/dialogs/RegenerateConfirmDialog.vue';
import StandingsDialog from '@/components/dialogs/StandingsDialog.vue';
import FollowBadge from '@/components/follow/FollowBadge.vue';
import AppHeader from '@/components/header/AppHeader.vue';
import ProgramPanel from '@/components/program/ProgramPanel.vue';
import ResultsPanel from '@/components/results/ResultsPanel.vue';
import StablePanel from '@/components/stable/StablePanel.vue';
import RaceTrack from '@/components/track/RaceTrack.vue';
import type { OpenDialog, ShortcutAction } from '@/composables/shortcuts';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useOutsideClick } from '@/composables/useOutsideClick';
import DashboardLayout from '@/layouts/DashboardLayout.vue';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import { computed } from 'vue';

/**
 * The race dashboard page: places the panels in the dashboard layout, mounts
 * the follow badge and the dialogs, and owns the page-wide interaction rules
 * (keyboard shortcuts, which dialog is open, click-outside to stop following).
 */
const race = useRaceStore();
const preferences = usePreferencesStore();

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
      if (race.confirmRegenerateOpen) race.cancelNewProgram();
      else if (race.standingsOpen) race.closeStandings();
      else race.dismissCompletion();
      break;
    case 'block':
      break;
  }
}

const openDialog = computed<OpenDialog | null>(() =>
  race.confirmRegenerateOpen
    ? 'confirm-regenerate'
    : race.standingsOpen
      ? race.phase === 'complete'
        ? 'final-standings'
        : 'standings'
      : race.completionOpen
        ? 'completion'
        : null,
);

useKeyboardShortcuts(() => ({ dialog: openDialog.value }), dispatch);

// Clicking somewhere non-interactive stops following (Esc does the same).
useOutsideClick(
  () => openDialog.value === null && preferences.followedHorseId !== null,
  () => {
    preferences.clearFollow();
  },
);
</script>

<template>
  <DashboardLayout>
    <template #header><AppHeader /></template>
    <template #track><RaceTrack /></template>
    <template #results><ResultsPanel /></template>
    <template #program><ProgramPanel /></template>
    <template #stable><StablePanel /></template>
  </DashboardLayout>
  <FollowBadge />
  <ProgramCompleteDialog />
  <RegenerateConfirmDialog />
  <StandingsDialog />
</template>
