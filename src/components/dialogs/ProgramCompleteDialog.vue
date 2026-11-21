<script setup lang="ts">
import { ref, watch } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import ColorTick from '@/components/ui/ColorTick.vue';
import ModalDialog from '@/components/ui/ModalDialog.vue';
import { useRaceStore } from '@/stores/race';

/**
 * The program summary. "Final standings" opens the standings table in its
 * place; closing the standings brings this summary back (only "View track"
 * dismisses it), with focus on the button that opened them and without
 * replaying the first reveal.
 */
const race = useRaceStore();

/** The staged reveal (waiting for the last winner card) only plays the first time. */
const revealed = ref(false);
/** True after visiting the standings, so focus returns to "Final standings". */
const returning = ref(false);

watch(
  () => race.completionOpen,
  (open, wasOpen) => {
    if (wasOpen && !open) revealed.value = true;
  },
);
watch(
  () => race.phase,
  (phase) => {
    if (phase !== 'complete') {
      revealed.value = false;
      returning.value = false;
    }
  },
);

function openStandings(): void {
  returning.value = true;
  race.openStandings();
}
</script>

<template>
  <ModalDialog
    :open="race.completionOpen"
    labelledby="program-complete-title"
    :reveal-delay="revealed ? '0s' : '0.9s'"
    :initial-focus="returning ? '[data-return-focus]' : ''"
  >
    <div class="complete__intro">
      <p class="complete__eyebrow mono">PROGRAM COMPLETE</p>
      <h2 id="program-complete-title" class="complete__title">All six rounds are official</h2>
    </div>
    <ol class="complete__winners" :class="{ 'is-revealed': revealed }" aria-label="Round winners">
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
        data-action="generate"
        @click="race.requestNewProgram()"
      >
        Generate new program
      </AppButton>
      <div class="complete__secondary">
        <AppButton class="complete__button" data-return-focus @click="openStandings()">
          Final standings
        </AppButton>
        <AppButton class="complete__button" @click="race.dismissCompletion()">View track</AppButton>
      </div>
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

/* Returning from the standings: the list is already known, show it at once. */
.is-revealed .complete__winner {
  animation: none;
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
  flex-direction: column;
  gap: 10px;
  margin-top: 2px;
}

.complete__primary {
  width: 100%;
}

/* Two equal secondary actions; they stack when the dialog is too narrow for both. */
.complete__secondary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
  gap: 8px;
}

.complete__button {
  width: 100%;
  padding: 0 12px;
}
</style>
