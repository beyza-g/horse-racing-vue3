<script setup lang="ts">
import ColorTick from '@/components/ui/ColorTick.vue';
import IconChevron from '@/components/ui/icons/IconChevron.vue';
import StatusPill from '@/components/ui/StatusPill.vue';
import type { CompletedRoundsView } from '@/viewModels';

defineProps<{ view: CompletedRoundsView }>();
defineEmits<{ inspect: [roundIndex: number]; backToLive: [] }>();
</script>

<template>
  <div class="completed">
    <div class="completed__head">
      <h3 class="completed__title">Completed rounds</h3>
      <span class="completed__count mono">{{ view.count }}</span>
    </div>
    <div class="completed__list">
      <p v-if="view.showHint" class="completed__hint">
        Winners collect here as rounds finish. Select one to see its full result.
      </p>
      <button
        v-for="row in view.rows"
        :key="row.roundIndex"
        type="button"
        class="completed__row"
        :class="{ 'is-selected': row.selected }"
        :aria-pressed="row.selected"
        :title="`Show the full result of Round ${row.roundIndex + 1}`"
        @click="$emit('inspect', row.roundIndex)"
      >
        <span class="completed__label mono">{{ row.label }}</span>
        <span class="completed__distance mono">{{ row.distance }}</span>
        <ColorTick :color="row.winnerColor" :height="13" />
        <span class="completed__name" :class="{ 'is-strong': row.followed }">{{
          row.winnerName
        }}</span>
        <span class="completed__time mono">{{ row.time }}</span>
        <IconChevron direction="right" class="completed__chevron" />
      </button>
      <button
        v-if="view.liveRow"
        type="button"
        class="completed__row completed__row--live"
        title="Show this round's live order"
        @click="$emit('backToLive')"
      >
        <span class="completed__label mono">{{ view.liveRow.label }}</span>
        <span class="completed__distance mono">{{ view.liveRow.distance }}</span>
        <span class="completed__live-text">{{ view.liveRow.text }}</span>
        <StatusPill size="sm" :label="view.liveRow.pill.label" :tone="view.liveRow.pill.tone" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.completed {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.completed__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 30px;
  margin-bottom: 6px;
}

.completed__title {
  margin: 0;
  font-size: 15px;
  font-weight: var(--title-w);
  font-stretch: 85%;
}

.completed__count {
  font-size: 12px;
  color: var(--muted);
}

.completed__list {
  border-top: 1px solid var(--line-strong);
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 4px;
}

.completed__hint {
  margin: 0;
  padding-top: 12px;
  font-size: 14px;
  color: var(--faint);
  line-height: 1.45;
}

.completed__row {
  height: 30px;
  display: grid;
  grid-template-columns: 24px 46px 4px minmax(0, 1fr) auto 10px;
  gap: 8px;
  align-items: center;
  padding: 0 10px 0 8px;
  border: none;
  border-radius: 7px;
  background-color: var(--chip);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.15s,
    box-shadow 0.15s;
}

.completed__row:hover {
  background-color: var(--chip-strong);
}

.completed__row.is-selected {
  background-color: var(--chip-strong);
  box-shadow: inset 0 0 0 1px var(--line-strong);
}

.completed__row--live {
  grid-template-columns: 24px 46px minmax(0, 1fr) auto;
  padding: 0 8px;
  border: 1px dashed var(--line-strong);
  background-color: transparent;
}

.completed__label {
  font-size: 11px;
  font-weight: 700;
}

.completed__distance {
  font-size: 11px;
  color: var(--faint);
}

.completed__name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.completed__name.is-strong {
  font-weight: 700;
}

.completed__time {
  font-size: 11.5px;
  color: var(--muted);
}

.completed__chevron {
  color: var(--faint);
}

.is-selected .completed__chevron {
  color: var(--text);
}

.completed__live-text {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
