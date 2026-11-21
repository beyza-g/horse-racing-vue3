<script setup lang="ts">
/** Thin colour bar identifying a horse in dense rows. */
defineProps<{ color: string; height?: number }>();
</script>

<template>
  <span class="color-tick" :style="{ background: color, height: `${height ?? 15}px` }" />
</template>

<style scoped>
.color-tick {
  width: 4px;
  border-radius: 2px;
  flex: none;
}
</style>
