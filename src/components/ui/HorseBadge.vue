<script setup lang="ts">
/** The horse's number on its unique silk colour. */
defineProps<{ number: string; color: string; muted?: boolean }>();
</script>

<template>
  <span class="horse-badge mono" :class="{ 'is-muted': muted }" :style="{ background: color }">{{
    number
  }}</span>
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
    filter 0.4s,
    opacity 0.4s;
}

.is-muted {
  filter: grayscale(1);
  opacity: 0.45;
}
</style>
