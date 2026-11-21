<script setup lang="ts">
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import CompletedRounds from './CompletedRounds.vue';
import ResultsLeaderboard from './ResultsLeaderboard.vue';

const race = useRaceStore();
const preferences = usePreferencesStore();
</script>

<template>
  <section
    class="results-panel"
    :class="{ 'is-dimmed': preferences.focusMode }"
    aria-label="Results"
  >
    <ResultsLeaderboard
      :board="race.board"
      @follow="preferences.toggleFollow"
      @back-to-live="race.inspectRound(null)"
    />
    <CompletedRounds
      :view="race.completedRounds"
      @inspect="race.inspectRound"
      @back-to-live="race.inspectRound(null)"
    />
  </section>
</template>

<style scoped>
.results-panel {
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 18px 28px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
  padding: 14px 18px 16px;
  box-shadow: var(--shadow);
  transition:
    opacity 0.5s,
    filter 0.5s,
    background 0.35s;
}

.results-panel.is-dimmed {
  opacity: var(--dim-opacity);
  filter: saturate(0.3);
}

@media (min-width: 760px) {
  .results-panel {
    grid-template-columns: minmax(0, 1.3fr) minmax(240px, 1fr);
  }
}
</style>
