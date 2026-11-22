<script setup lang="ts">
import IconPause from '@/components/ui/icons/IconPause.vue';
import IconPlay from '@/components/ui/icons/IconPlay.vue';
import type { PlaybackControlView } from '@/viewModels';

defineProps<{ control: PlaybackControlView }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    type="button"
    class="playback-button"
    :disabled="!control.enabled"
    title="Start / Pause (Space)"
    @click="$emit('toggle')"
  >
    <IconPause v-if="control.icon === 'pause'" />
    <IconPlay v-else />
    <span>{{ control.label }}</span>
  </button>
</template>

<style scoped>
.playback-button {
  height: var(--control-h);
  min-width: 124px;
  padding: 0 18px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition:
    filter 0.2s,
    opacity 0.3s;
}

.playback-button:hover:not(:disabled) {
  filter: brightness(1.06);
}

.playback-button:active:not(:disabled) {
  transform: scale(0.97);
}

.playback-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
