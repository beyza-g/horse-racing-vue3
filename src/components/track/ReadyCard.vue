<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import IconPlay from '@/components/ui/icons/IconPlay.vue';

/**
 * Shown over the track while round 1 waits at the gates: the start action
 * sits where the user is looking instead of only in the header. It is an
 * overlay, so it never moves the layout. Later rounds start automatically.
 */
defineProps<{ round: number; distance: string; runners: number }>();
defineEmits<{ start: [] }>();

const root = ref<HTMLElement | null>(null);

/**
 * Move focus to Start only when the user just generated the program (focus
 * is on a Generate control or was dropped to the body), so Space or Enter
 * starts the race next. Focus elsewhere is never stolen.
 */
onMounted(() => {
  const active = document.activeElement;
  const justGenerated =
    active === null ||
    active === document.body ||
    (active instanceof HTMLElement && active.dataset['action'] === 'generate');
  if (justGenerated) root.value?.querySelector('button')?.focus({ preventScroll: true });
});
</script>

<template>
  <div class="ready-card">
    <div ref="root" class="ready-card__panel">
      <p class="ready-card__eyebrow mono">ROUND {{ round }} · {{ distance.toUpperCase() }}</p>
      <h2 class="ready-card__title">{{ runners }} runners at the gates</h2>
      <AppButton
        variant="primary"
        size="lg"
        class="ready-card__start"
        :aria-label="`Start round ${round}`"
        @click="$emit('start')"
      >
        <IconPlay />
        <span>Start race</span>
      </AppButton>
      <p class="ready-card__hint">or press <kbd class="mono">Space</kbd></p>
    </div>
  </div>
</template>

<style scoped>
.ready-card {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  pointer-events: none;
}

.ready-card__panel {
  pointer-events: auto;
  min-width: min(300px, 100%);
  padding: 20px 26px 16px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--line-strong);
  background: var(--panel);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  animation: ready-in 0.35s var(--ease-spring) both;
}

@keyframes ready-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

.ready-card__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--accent-text);
}

.ready-card__title {
  margin: 0;
  font-size: 22px;
  font-weight: var(--title-w);
  font-stretch: 80%;
}

.ready-card__start {
  margin-top: 6px;
  min-width: 180px;
}

.ready-card__hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--muted);
}

.ready-card__hint kbd {
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--line-strong);
  background: var(--chip);
  font-size: 11px;
  color: var(--text);
}
</style>
