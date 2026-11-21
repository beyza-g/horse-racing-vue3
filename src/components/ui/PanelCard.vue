<script setup lang="ts">
/**
 * Wrapper for the side panels: card chrome, an optional title row with an
 * actions slot, and the focus-mode dimming. Content goes in the default slot.
 */
withDefaults(
  defineProps<{
    title?: string;
    as?: 'section' | 'aside';
    dimmed?: boolean;
    headingId?: string;
  }>(),
  { title: '', as: 'section', dimmed: false, headingId: 'panel-heading' },
);
</script>

<template>
  <component
    :is="as"
    class="panel-card"
    :class="{ 'is-dimmed': dimmed }"
    :aria-labelledby="title ? headingId : undefined"
  >
    <div v-if="title" class="panel-card__head">
      <h2 :id="headingId" class="panel-card__title">{{ title }}</h2>
      <slot name="actions" />
    </div>
    <slot />
  </component>
</template>

<style scoped>
.panel-card {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
  padding: 16px 12px 10px;
  box-shadow: var(--shadow);
  transition:
    opacity 0.5s,
    filter 0.5s,
    background 0.35s;
}

.panel-card.is-dimmed {
  opacity: var(--dim-opacity);
  filter: saturate(0.3);
}

.panel-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 4px 12px;
}

.panel-card__title {
  margin: 0;
  font-size: 19px;
  font-weight: var(--title-w);
  font-stretch: 80%;
}
</style>
