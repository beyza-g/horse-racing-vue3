<script setup lang="ts">
import PanelCard from '@/components/ui/PanelCard.vue';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import RoundCard from './RoundCard.vue';

const race = useRaceStore();
const preferences = usePreferencesStore();
</script>

<template>
  <PanelCard
    title="Program"
    as="aside"
    heading-id="program-heading"
    :dimmed="preferences.focusMode"
  >
    <div class="program-panel__list">
      <RoundCard
        v-for="card in race.rounds"
        :key="card.index"
        :card="card"
        @toggle="race.toggleRoundExpanded"
        @follow="preferences.toggleFollow"
      />
    </div>
  </PanelCard>
</template>

<style scoped>
.program-panel__list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
