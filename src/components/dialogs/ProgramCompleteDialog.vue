<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue';
import ColorTick from '@/components/ui/ColorTick.vue';
import ModalDialog from '@/components/ui/ModalDialog.vue';
import { useRaceStore } from '@/stores/race';

const race = useRaceStore();
</script>

<template>
  <ModalDialog :open="race.completionOpen" labelledby="program-complete-title">
    <div class="complete__intro">
      <p class="complete__eyebrow mono">PROGRAM COMPLETE</p>
      <h2 id="program-complete-title" class="complete__title">All six rounds are official</h2>
    </div>
    <ol class="complete__winners" aria-label="Round winners">
      <li
        v-for="(row, index) in race.completionWinners"
        :key="row.roundIndex"
        class="complete__winner"
        :style="{ '--delay': `${1150 + index * 80}ms` }"
      >
        <span class="complete__round mono">{{ row.label }}</span>
        <ColorTick :color="row.winnerColor" :height="13" />
        <span class="complete__name">{{ row.winnerName }}</span>
        <span class="complete__time mono">{{ row.time }}</span>
      </li>
    </ol>
    <div class="complete__actions">
      <AppButton
        variant="primary"
        size="lg"
        class="complete__primary"
        @click="race.generateProgram()"
      >
        Generate new program
      </AppButton>
      <AppButton size="lg" @click="race.dismissCompletion()">View track</AppButton>
    </div>
  </ModalDialog>
</template>

<style scoped>
.complete__intro {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.complete__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--accent-text);
}

.complete__title {
  margin: 0;
  font-size: 24px;
  font-weight: var(--title-w);
  font-stretch: 80%;
  line-height: 1.1;
}

.complete__winners {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}

.complete__winner {
  height: 28px;
  display: grid;
  grid-template-columns: 26px 4px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  border-bottom: 1px solid var(--line);
  animation: winner-in 0.7s var(--ease-spring) var(--delay) both;
}

@keyframes winner-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

.complete__round {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}

.complete__name {
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.complete__time {
  font-size: 11.5px;
  color: var(--muted);
}

.complete__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.complete__primary {
  flex: 1 1 180px;
}
</style>
