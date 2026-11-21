<script setup lang="ts">
import StatusPill from '@/components/ui/StatusPill.vue';
import type { StatusView } from '@/stores/raceView';

defineProps<{ status: StatusView }>();
</script>

<template>
  <div class="status-indicator" role="status" aria-live="polite">
    <span class="status-indicator__dot" :class="`is-${status.dot}`" aria-hidden="true" />
    <span class="status-indicator__label">{{ status.label }}</span>
    <StatusPill v-if="status.pill" :label="status.pill.label" :tone="status.pill.tone" />
  </div>
</template>

<style scoped>
.status-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  height: 22px;
}

.status-indicator__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
  background: var(--faint);
  transition: background 0.3s;
}

.is-active {
  background: var(--accent);
}

.is-muted {
  background: var(--muted);
}

.is-steady {
  background: var(--text);
}

.status-indicator__label {
  font-size: 15px;
  font-weight: 600;
  font-stretch: 88%;
  white-space: nowrap;
}
</style>
