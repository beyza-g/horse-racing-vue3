<script setup lang="ts">
import ConditionBadge from '@/components/ui/ConditionBadge.vue';
import HorseBadge from '@/components/ui/HorseBadge.vue';
import IconChevron from '@/components/ui/icons/IconChevron.vue';
import StatusPill from '@/components/ui/StatusPill.vue';
import type { HorseId } from '@/domain';
import type { RoundCardView } from '@/stores/raceView';

const props = defineProps<{ card: RoundCardView }>();
defineEmits<{ toggle: [roundIndex: number]; follow: [horseId: HorseId] }>();
const lineupId = `round-${props.card.index + 1}-lineup`;
</script>

<template>
  <div class="round-card" :class="{ 'is-current': card.current, 'is-expanded': card.expanded }">
    <button
      type="button"
      class="round-card__head"
      :disabled="!card.available"
      :aria-expanded="card.expanded"
      :aria-controls="card.expanded ? lineupId : undefined"
      :title="
        card.available
          ? card.expanded
            ? 'Hide line-up'
            : 'Show line-up'
          : 'Generate a program first'
      "
      @click="$emit('toggle', card.index)"
    >
      <span class="round-card__title" :class="{ 'is-muted': card.official && !card.expanded }">{{
        card.title
      }}</span>
      <span class="round-card__distance">{{ card.distance }}</span>
      <StatusPill
        v-if="card.pill"
        class="round-card__pill"
        :label="card.pill.label"
        :tone="card.pill.tone"
      />
      <IconChevron
        class="round-card__chevron"
        :class="{ 'is-pushed': !card.pill }"
        :direction="card.expanded ? 'up' : 'down'"
      />
    </button>
    <div v-if="card.expanded" :id="lineupId" class="round-card__lineup">
      <div class="round-card__columns mono" aria-hidden="true">
        <span>LANE</span><span>NO</span><span>HORSE</span><span class="is-right">COND</span>
      </div>
      <button
        v-for="row in card.lineup"
        :key="row.horseId"
        type="button"
        class="round-card__row"
        :class="{ 'is-followed': row.followed }"
        :aria-pressed="row.followed"
        :title="`Lane ${row.lane} · No ${row.number} ${row.name} · ${row.condition.description}`"
        @click="$emit('follow', row.horseId)"
      >
        <span class="round-card__lane mono">{{ row.lane }}</span>
        <HorseBadge :number="row.number" :color="row.color" />
        <span class="round-card__name" :class="{ 'is-strong': row.followed }">{{ row.name }}</span>
        <ConditionBadge :condition="row.condition" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.round-card {
  border-radius: 9px;
  border: 1px solid transparent;
  transition:
    border-color 0.3s,
    background 0.3s;
}

.round-card.is-current {
  border-color: var(--sel-line);
}

.round-card.is-expanded {
  background: var(--chip);
}

.round-card__head {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  border-radius: 9px;
  background-color: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.round-card__head:hover:not(:disabled) {
  background-color: var(--chip-strong);
}

.round-card__head:disabled {
  cursor: default;
}

.round-card__title {
  font-size: 14.5px;
  font-weight: var(--title-w);
  font-stretch: 82%;
  white-space: nowrap;
}

.round-card__title.is-muted {
  color: var(--muted);
}

.round-card__distance {
  font-size: 13px;
  color: var(--muted);
}

.round-card__pill {
  margin-left: auto;
}

.round-card__chevron {
  color: var(--muted);
  margin-left: 2px;
}

.round-card__chevron.is-pushed {
  margin-left: auto;
}

.round-card__lineup {
  padding: 0 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.round-card__columns,
.round-card__row {
  display: grid;
  grid-template-columns: 32px 22px minmax(0, 1fr) 40px;
  gap: 8px;
  align-items: center;
  padding: 0 6px;
}

.round-card__columns {
  padding-bottom: 4px;
  font-size: 9.5px;
  font-weight: var(--label-w);
  letter-spacing: 0.1em;
  color: var(--faint);
}

.is-right {
  text-align: right;
}

.round-card__row {
  height: 27px;
  border: none;
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.round-card__row:hover {
  background-color: var(--row-hover);
}

.round-card__row.is-followed {
  background-image: linear-gradient(var(--sel-bg), var(--sel-bg));
  box-shadow: inset 0 0 0 1px var(--sel-line);
}

.round-card__row.is-followed:hover {
  background-image: linear-gradient(var(--row-hover-selected), var(--row-hover-selected));
}

.round-card__lane {
  font-size: 11px;
  color: var(--faint);
}

.round-card__name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.round-card__name.is-strong {
  font-weight: 700;
}
</style>
