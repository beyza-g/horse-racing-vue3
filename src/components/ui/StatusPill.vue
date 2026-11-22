<script setup lang="ts">
import type { PillTone } from '@/viewModels';

/**
 * Status pill. The `live` tone carries a pulsing dot: a solid dot in the
 * pill's text colour with a ring that expands and fades (transform and
 * opacity only, so it never affects layout). Under reduced motion the ring
 * is hidden and the dot stays still.
 */
defineProps<{ label: string; tone: PillTone; size?: 'sm' | 'md' }>();
</script>

<template>
  <span class="status-pill" :class="[`status-pill--${tone}`, `status-pill--${size ?? 'md'}`]">
    <span v-if="tone === 'live'" class="status-pill__pulse" aria-hidden="true" />
    {{ label }}
  </span>
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
  gap: 6px;
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
  padding-left: 8px;
}

.status-pill__pulse {
  position: relative;
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: currentColor;
}

.status-pill__pulse::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: currentColor;
  animation: live-pulse 1.6s ease-out infinite;
}

@keyframes live-pulse {
  0% {
    transform: scale(1);
    opacity: 0.55;
  }

  80%,
  100% {
    transform: scale(2.6);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-pill__pulse::after {
    animation: none;
    opacity: 0;
  }
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
