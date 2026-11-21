<script setup lang="ts">
withDefaults(defineProps<{ direction?: 'down' | 'up' | 'right' | 'left' }>(), {
  direction: 'down',
});
</script>

<template>
  <svg
    viewBox="0 0 10 10"
    width="9"
    height="9"
    aria-hidden="true"
    focusable="false"
    class="chevron"
    :class="`chevron--${direction}`"
  >
    <path
      d="M2 3.5L5 6.5L8 3.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.chevron {
  flex: none;
  transition: transform 0.25s;
}

.chevron--up {
  transform: rotate(180deg);
}

.chevron--right {
  transform: rotate(-90deg);
}

.chevron--left {
  transform: rotate(90deg);
}
</style>
