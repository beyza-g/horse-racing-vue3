<script setup lang="ts">
import PanelCard from '@/components/ui/PanelCard.vue';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import ConditionLegend from './ConditionLegend.vue';
import StableTable from './StableTable.vue';

const race = useRaceStore();
const preferences = usePreferencesStore();
</script>

<template>
  <PanelCard title="Stable" as="aside" heading-id="stable-heading" :dimmed="preferences.focusMode">
    <StableTable :rows="race.stable" @follow="preferences.toggleFollow" />
    <ConditionLegend />
  </PanelCard>
</template>
