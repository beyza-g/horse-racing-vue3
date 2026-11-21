<script setup lang="ts">
/**
 * Compact segmented tabs following the WAI-ARIA tabs pattern: one tab stop
 * (roving tabindex), arrow keys / Home / End move between tabs and select
 * them, and each tab controls a panel whose id is `${idPrefix}-panel-${id}`.
 */
const props = defineProps<{
  tabs: readonly { readonly id: string; readonly label: string }[];
  modelValue: string;
  idPrefix: string;
  label: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [id: string] }>();

function select(index: number, event: KeyboardEvent | null): void {
  const count = props.tabs.length;
  const tab = props.tabs[((index % count) + count) % count];
  if (tab === undefined) return;
  emit('update:modelValue', tab.id);
  if (event !== null) {
    const list = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
    list?.querySelector<HTMLElement>(`#${props.idPrefix}-tab-${tab.id}`)?.focus();
  }
}

function onKeydown(event: KeyboardEvent, index: number): void {
  const moves: Record<string, number> = {
    ArrowRight: index + 1,
    ArrowLeft: index - 1,
    Home: 0,
    End: props.tabs.length - 1,
  };
  const target = moves[event.key];
  if (target === undefined) return;
  event.preventDefault();
  select(target, event);
}
</script>

<template>
  <div class="tab-switch" role="tablist" :aria-label="label">
    <button
      v-for="(tab, index) in tabs"
      :id="`${idPrefix}-tab-${tab.id}`"
      :key="tab.id"
      type="button"
      role="tab"
      class="tab-switch__tab"
      :class="{ 'is-active': tab.id === modelValue }"
      :aria-selected="tab.id === modelValue"
      :aria-controls="`${idPrefix}-panel-${tab.id}`"
      :tabindex="tab.id === modelValue ? 0 : -1"
      @click="select(index, null)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.tab-switch {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  height: 28px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  flex: none;
}

.tab-switch__tab {
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.tab-switch__tab:hover:not(.is-active) {
  background-color: var(--row-hover);
  color: var(--text);
}

.tab-switch__tab.is-active {
  background-color: var(--text);
  color: var(--panel);
}
</style>
