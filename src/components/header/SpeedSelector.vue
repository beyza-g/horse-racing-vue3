<script setup lang="ts">
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/playback';

defineProps<{ modelValue: PlaybackSpeed }>();
defineEmits<{ 'update:modelValue': [speed: PlaybackSpeed] }>();
</script>

<template>
  <div
    class="speed-selector"
    role="group"
    aria-label="Playback speed"
    title="Playback speed (1 / 2 / 4)"
  >
    <button
      v-for="speed in PLAYBACK_SPEEDS"
      :key="speed"
      type="button"
      class="speed-selector__option mono"
      :class="{ 'is-active': speed === modelValue }"
      :aria-pressed="speed === modelValue"
      @click="$emit('update:modelValue', speed)"
    >
      {{ speed }}x
    </button>
  </div>
</template>

<style scoped>
.speed-selector {
  display: flex;
  padding: 3px;
  gap: 2px;
  height: var(--control-h);
  border: 1px solid var(--line-strong);
  border-radius: 9px;
  flex: none;
}

.speed-selector__option {
  min-width: 36px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.speed-selector__option:hover {
  filter: brightness(1.1);
}

.speed-selector__option.is-active {
  background-color: var(--text);
  color: var(--panel);
}
</style>
