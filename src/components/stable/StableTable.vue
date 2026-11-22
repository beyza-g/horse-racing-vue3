<script setup lang="ts">
import ConditionBadge from '@/components/ui/ConditionBadge.vue';
import HorseBadge from '@/components/ui/HorseBadge.vue';
import type { HorseId } from '@/domain';
import type { StableRow } from '@/viewModels';

defineProps<{ rows: readonly StableRow[] }>();
defineEmits<{ follow: [horseId: HorseId] }>();
</script>

<template>
  <div class="stable-table">
    <div class="stable-table__columns mono" aria-hidden="true">
      <span>NO</span><span>HORSE</span><span class="is-right">LANE</span
      ><span class="is-right">COND</span>
    </div>
    <ul class="stable-table__rows" aria-label="All horses">
      <li v-for="row in rows" :key="row.horseId">
        <button
          type="button"
          class="stable-table__row"
          :class="{ 'is-followed': row.followed, 'is-out': row.sittingOut }"
          :aria-pressed="row.followed"
          :title="`No ${row.number} · ${row.name} · ${row.condition.description} · ${row.followed ? 'click to stop following' : 'click to follow'}`"
          @click="$emit('follow', row.horseId)"
        >
          <HorseBadge :number="row.number" :color="row.color" :muted="row.sittingOut" />
          <span class="stable-table__name" :class="{ 'is-strong': row.followed }">{{
            row.name
          }}</span>
          <span class="stable-table__lane mono" :class="{ 'is-in': row.inRound }">{{
            row.lane
          }}</span>
          <ConditionBadge :condition="row.condition" :muted="row.sittingOut" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.stable-table {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.stable-table__columns,
.stable-table__row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 24px 36px;
  gap: 6px;
  align-items: center;
}

.stable-table__columns {
  padding: 0 8px 6px 6px;
  font-size: 9.5px;
  font-weight: var(--label-w);
  letter-spacing: 0.1em;
  color: var(--faint);
  border-bottom: 1px solid var(--line);
}

.is-right {
  text-align: right;
}

.stable-table__rows {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 4px 0 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  align-content: start;
  gap: 1px 16px;
}

.stable-table__row {
  width: 100%;
  height: 30px;
  padding: 0 8px 0 6px;
  border: none;
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    opacity 0.4s,
    background-color 0.15s;
}

.stable-table__row:hover {
  background-color: var(--row-hover);
}

.stable-table__row.is-followed {
  background-image: linear-gradient(var(--sel-bg), var(--sel-bg));
  box-shadow: inset 0 0 0 1px var(--sel-line);
}

.stable-table__row.is-followed:hover {
  background-image: linear-gradient(var(--row-hover-selected), var(--row-hover-selected));
}

.stable-table__name {
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.4s;
}

.stable-table__name.is-strong {
  font-weight: 700;
}

.is-out .stable-table__name {
  color: var(--inactive-fg);
}

.stable-table__lane {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--faint);
  text-align: right;
}

.stable-table__lane.is-in {
  color: var(--accent-text);
}
</style>
