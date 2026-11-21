<script setup lang="ts">
/** Key for the condition markers used in the stable and program tables. */
const ITEMS = [
  { tone: 'fit', label: 'Race fit', hint: 'BCS 4-5' },
  { tone: 'near', label: 'Lean / fleshy', hint: 'BCS 3.5-4, 5-6.5' },
  { tone: 'off', label: 'Out of condition', hint: 'below 3.5 or 6.5+' },
] as const;
</script>

<template>
  <ul class="condition-legend" aria-label="Condition key">
    <li v-for="item in ITEMS" :key="item.tone" class="condition-legend__item" :title="item.hint">
      <span class="condition-legend__marker" :class="`is-${item.tone}`" aria-hidden="true" />
      {{ item.label }}
    </li>
  </ul>
</template>

<style scoped>
.condition-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  padding: 8px 6px 2px;
  list-style: none;
  border-top: 1px solid var(--line);
  font-size: 11px;
  color: var(--muted);
}

.condition-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.condition-legend__marker {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.condition-legend__marker.is-fit {
  background: var(--cond-fit);
}

.condition-legend__marker.is-near {
  box-shadow: inset 0 0 0 1.5px var(--cond-near);
}

.condition-legend__marker.is-off {
  height: 3px;
  border-radius: 1px;
  background: var(--cond-off);
}
</style>
