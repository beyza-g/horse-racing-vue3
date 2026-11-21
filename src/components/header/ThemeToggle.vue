<script setup lang="ts">
import { computed } from 'vue';
import IconMoon from '@/components/ui/icons/IconMoon.vue';
import IconSun from '@/components/ui/icons/IconSun.vue';
import type { Theme } from '@/render';

const props = defineProps<{ theme: Theme }>();
defineEmits<{ toggle: [] }>();

const light = computed(() => props.theme === 'light');
const title = computed(() =>
  light.value ? 'Switch to dark theme (T)' : 'Switch to light theme (T)',
);
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :class="{ 'is-light': light }"
    role="switch"
    :aria-checked="!light"
    :aria-label="title"
    :title="title"
    @click="$emit('toggle')"
  >
    <span class="theme-toggle__knob" aria-hidden="true" />
    <span class="theme-toggle__icon theme-toggle__icon--sun"><IconSun /></span>
    <span class="theme-toggle__icon theme-toggle__icon--moon"><IconMoon /></span>
  </button>
</template>

<style scoped>
.theme-toggle {
  position: relative;
  width: 64px;
  height: 34px;
  flex: none;
  padding: 0;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-strong);
  background: var(--chip);
  cursor: pointer;
  transition:
    background 0.3s,
    border-color 0.3s;
}

.theme-toggle__knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--knob);
  transform: translateX(28px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition:
    transform 0.35s var(--ease-knob),
    background 0.3s;
}

.is-light .theme-toggle__knob {
  transform: translateX(0);
}

.theme-toggle__icon {
  position: absolute;
  top: 3px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--faint);
  transition: color 0.3s;
}

.theme-toggle__icon--sun {
  left: 3px;
}

.theme-toggle__icon--moon {
  left: 31px;
  color: var(--knob-ink);
}

.is-light .theme-toggle__icon--sun {
  color: var(--knob-ink);
}

.is-light .theme-toggle__icon--moon {
  color: var(--faint);
}
</style>
