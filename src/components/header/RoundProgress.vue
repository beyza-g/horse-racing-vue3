<script setup lang="ts">
import type { ProgressSegment } from '@/viewModels';

defineProps<{ segments: readonly ProgressSegment[] }>();
</script>

<template>
  <ol class="round-progress" aria-label="Round progress">
    <li
      v-for="(segment, index) in segments"
      :key="index"
      class="round-progress__segment"
      :class="`is-${segment.state}`"
      :title="segment.title"
    >
      <span class="visually-hidden">{{ segment.title }}: {{ segment.state }}</span>
    </li>
  </ol>
</template>

<style scoped>
.round-progress {
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.round-progress__segment {
  width: 22px;
  height: 4px;
  border-radius: 2px;
  background: var(--chip-strong);
  transition: background 0.4s;
}

.is-done {
  background: var(--text);
}

.is-current {
  background: var(--accent);
}
</style>
