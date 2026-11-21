<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRaceLoop } from '@/composables/useRaceLoop';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import EmptyProgramCard from './EmptyProgramCard.vue';

const race = useRaceStore();
const preferences = usePreferencesStore();
const canvas = ref<HTMLCanvasElement | null>(null);
const { horseAtClientY } = useRaceLoop(canvas);

const label = computed(() =>
  race.hasProgram
    ? `Race track. ${race.status.label}${race.status.pill ? `, ${race.status.pill.label}` : ''}. Click a lane to follow its horse.`
    : 'Race track. No program yet.',
);

function onCanvasClick(event: MouseEvent): void {
  const horseId = horseAtClientY(event.clientY);
  if (horseId !== null) preferences.toggleFollow(horseId);
}
</script>

<template>
  <div class="race-track" :class="{ 'is-focused': preferences.focusMode }">
    <canvas
      ref="canvas"
      class="race-track__canvas"
      :class="{ 'is-clickable': race.hasProgram }"
      role="img"
      :aria-label="label"
      @click="onCanvasClick"
    />
    <EmptyProgramCard v-if="!race.hasProgram" @generate="race.generateProgram()" />
  </div>
</template>

<style scoped>
.race-track {
  position: relative;
  height: 100%;
  min-height: 300px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--track);
  border: 1px solid var(--line);
  transition:
    border-color 0.5s,
    box-shadow 0.5s;
}

.race-track.is-focused {
  border-color: var(--sel-line);
  box-shadow: 0 0 0 4px var(--sel-bg);
}

.race-track__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.race-track__canvas.is-clickable {
  cursor: pointer;
}
</style>
