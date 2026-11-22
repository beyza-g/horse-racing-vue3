<script setup lang="ts">
import type { StandingMovement } from '@/viewModels';

/**
 * Standings movement since the previous round: a triangle (shape carries the
 * direction, colour only reinforces it) and the number of places. Decorative
 * for assistive technology: the row's label already says it in words.
 * Renders an empty slot of the same width when there is no movement, so rows
 * never shift.
 */
defineProps<{ movement: StandingMovement | null }>();
</script>

<template>
  <span
    class="movement mono"
    :class="movement ? `is-${movement.direction}` : null"
    aria-hidden="true"
  >
    <template v-if="movement">
      <svg viewBox="0 0 8 7" width="7" height="6" focusable="false">
        <path v-if="movement.direction === 'up'" d="M4 0L8 7H0Z" fill="currentColor" />
        <path v-else d="M0 0H8L4 7Z" fill="currentColor" />
      </svg>
      {{ movement.places }}
    </template>
  </span>
</template>

<style scoped>
.movement {
  width: 24px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.is-up {
  color: var(--move-up);
}

.is-down {
  color: var(--move-down);
}
</style>
