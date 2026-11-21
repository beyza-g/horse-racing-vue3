<script setup lang="ts">
import type { PillTone } from '@/stores/raceView';

defineProps<{ label: string; tone: PillTone; size?: 'sm' | 'md' }>();
</script>

<template>
  <span class="status-pill" :class="[`status-pill--${tone}`, `status-pill--${size ?? 'md'}`]">{{
    label
  }}</span>
</template>

<style scoped>
.status-pill {
  height: 22px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  flex: none;
}

.status-pill--sm {
  height: 20px;
  padding: 0 8px;
  font-size: 11.5px;
}

.status-pill--live {
  background: var(--accent);
  color: var(--on-accent);
}

.status-pill--paused {
  background: var(--text);
  color: var(--panel);
}

.status-pill--gates {
  background: var(--sel-bg);
  color: var(--accent-text);
  box-shadow: inset 0 0 0 1px var(--sel-line);
}

.status-pill--official {
  background: var(--chip-strong);
  color: var(--text);
  box-shadow: inset 0 0 0 1px var(--line-strong);
}
</style>
