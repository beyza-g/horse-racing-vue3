<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue';
import ModalDialog from '@/components/ui/ModalDialog.vue';
import { useRaceStore } from '@/stores/race';

/**
 * Asks before Generate discards a race in progress or official results.
 * The safe choice comes first and receives focus; Enter cannot confirm
 * unless the destructive button itself is focused.
 */
const race = useRaceStore();
</script>

<template>
  <ModalDialog
    :open="race.confirmRegenerateOpen"
    labelledby="regenerate-title"
    describedby="regenerate-description"
  >
    <div class="confirm__intro">
      <p class="confirm__eyebrow mono">NEW PROGRAM</p>
      <h2 id="regenerate-title" class="confirm__title">Discard the current program?</h2>
      <p id="regenerate-description" class="confirm__text">
        {{ race.discardedProgress }} will be discarded. The race is paused while you decide.
      </p>
    </div>
    <div class="confirm__actions">
      <AppButton size="lg" @click="race.cancelNewProgram()"> Keep this program </AppButton>
      <AppButton
        variant="danger"
        size="lg"
        data-action="generate"
        @click="race.confirmNewProgram()"
      >
        Discard and generate
      </AppButton>
    </div>
  </ModalDialog>
</template>

<style scoped>
.confirm__intro {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.confirm__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--accent-text);
}

.confirm__title {
  margin: 0;
  font-size: 24px;
  font-weight: var(--title-w);
  font-stretch: 80%;
  line-height: 1.1;
}

.confirm__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--muted);
}

/* Stacked, equal-width actions: the safe choice first, the destructive one below. */
.confirm__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
