<script setup lang="ts">
import type { ConditionView } from '@/viewModels';

/**
 * Condition score with a marker for its body condition band. The marker's
 * shape differs by tone (filled dot = race fit, ring = near, bar = off), so
 * colour is never the only cue; the full description is exposed as a label.
 */
defineProps<{ condition: ConditionView; muted?: boolean }>();
</script>

<template>
  <span
    class="condition-badge mono"
    :class="[`is-${condition.tone}`, { 'is-muted': muted }]"
    role="img"
    :aria-label="condition.description"
    :title="condition.description"
  >
    <span class="condition-badge__marker" aria-hidden="true" />
    <span class="condition-badge__value" aria-hidden="true">{{ condition.value }}</span>
  </span>
</template>

<style scoped>
.condition-badge {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  white-space: nowrap;
}

.condition-badge__marker {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
}

.is-fit .condition-badge__marker {
  background: var(--cond-fit);
}

.is-near .condition-badge__marker {
  box-shadow: inset 0 0 0 1.5px var(--cond-near);
}

.is-off .condition-badge__marker {
  height: 3px;
  border-radius: 1px;
  background: var(--cond-off);
}

.is-fit .condition-badge__value {
  color: var(--text);
  font-weight: 600;
}

/* Inactive: one gray for the value and the marker; the marker keeps its shape. */
.is-muted,
.is-muted .condition-badge__value {
  color: var(--inactive-fg);
  font-weight: 400;
}

.is-muted.is-fit .condition-badge__marker,
.is-muted.is-off .condition-badge__marker {
  background: var(--inactive-fg);
}

.is-muted.is-near .condition-badge__marker {
  box-shadow: inset 0 0 0 1.5px var(--inactive-fg);
}
</style>
