<script setup lang="ts">
/** The app's button. Always a native <button type="button">; extra attributes fall through. */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'md' | 'lg';
    /** Visual "on" state for toggle buttons (pair it with aria-pressed). */
    active?: boolean;
  }>(),
  { variant: 'secondary', size: 'md', active: false },
);
</script>

<template>
  <button
    type="button"
    class="app-button"
    :class="[`app-button--${variant}`, `app-button--${size}`, { 'is-active': active }]"
  >
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  height: var(--control-h);
  padding: 0 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line-strong);
  background-color: transparent;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition:
    background-color 0.2s,
    border-color 0.2s,
    box-shadow 0.2s,
    filter 0.2s;
}

.app-button:hover:not(:disabled) {
  background-image: linear-gradient(var(--chip-strong), var(--chip-strong));
}

.app-button:active:not(:disabled) {
  transform: scale(0.97);
}

.app-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.app-button--primary {
  border-color: var(--accent);
  background-color: var(--accent);
  color: var(--on-accent);
  font-weight: 700;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.25) inset,
    0 2px 10px rgba(226, 161, 54, 0.25);
}

.app-button--primary:hover:not(:disabled) {
  background-image: none;
  filter: brightness(1.06);
}

.app-button--danger {
  border-color: var(--danger);
  background-color: var(--danger);
  color: var(--on-danger);
  font-weight: 700;
}

.app-button--danger:hover:not(:disabled) {
  background-image: none;
  filter: brightness(1.06);
}

.app-button--lg {
  height: 44px;
  padding: 0 22px;
  border-radius: 9px;
  font-size: 15px;
}

.is-active {
  background-color: var(--sel-bg);
  border-color: var(--sel-line);
}
</style>
