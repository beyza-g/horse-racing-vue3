<script setup lang="ts">
import PanelCard from '@/components/ui/PanelCard.vue';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import StableTable from './StableTable.vue';

const race = useRaceStore();
const preferences = usePreferencesStore();
</script>

<template>
  <PanelCard title="Stable" as="aside" heading-id="stable-heading" :dimmed="preferences.focusMode">
    <StableTable :rows="race.stable" @follow="preferences.toggleFollow" />
  </PanelCard>
</template>
