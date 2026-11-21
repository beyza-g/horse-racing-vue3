<script setup lang="ts">
/**
 * The horse's number on its unique silk colour. When muted (sitting out the
 * current round) it switches to the shared inactive chip rather than a
 * desaturated silk, which would give every horse a different gray.
 */
defineProps<{ number: string; color: string; muted?: boolean }>();
</script>

<template>
  <span
    class="horse-badge mono"
    :class="{ 'is-muted': muted }"
    :style="muted ? undefined : { background: color }"
    >{{ number }}</span
  >
</template>

<style scoped>
.horse-badge {
  width: 22px;
  height: 17px;
  border-radius: 4px;
  color: #0c100e;
  font-size: 9.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  transition:
    background-color 0.4s,
    color 0.4s;
}

.is-muted {
  background: var(--inactive-bg);
  color: var(--inactive-fg);
}
</style>
