<script setup lang="ts">
import { ref, toRef } from 'vue';
import { useFocusTrap } from '@/composables/useFocusTrap';

/**
 * Blocking modal wrapper: teleported to <body>, `aria-modal`, focus trapped
 * (first focusable element gets focus), the app behind it made `inert`, and
 * focus restored on close. It never closes itself; the parent decides.
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    labelledby: string;
    /** Selector of the background made inert while open. */
    inertSelector?: string;
  }>(),
  { inertSelector: '#app' },
);

const panel = ref<HTMLElement | null>(null);
useFocusTrap(panel, toRef(props, 'open'), {
  inertTargets: () => {
    const target = document.querySelector(props.inertSelector);
    return target === null ? [] : [target];
  },
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div v-if="open" class="modal-scrim">
        <div
          ref="panel"
          class="modal-panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="labelledby"
          tabindex="-1"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-scrim {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--scrim);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.modal-panel {
  width: min(380px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-xl);
  padding: 22px 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
  outline: none;
}

/* The reveal waits for the last winner card to settle (no timers in game flow). */
.modal-enter-active {
  transition:
    background 0.8s ease 0.9s,
    backdrop-filter 0.8s ease 0.9s;
}

.modal-enter-active .modal-panel {
  transition:
    opacity 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 0.9s,
    transform 0.8s var(--ease-spring) 0.9s;
}

.modal-leave-active,
.modal-leave-active .modal-panel {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  background: transparent;
  backdrop-filter: blur(0);
  -webkit-backdrop-filter: blur(0);
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(18px) scale(0.96);
}
</style>
