<script setup lang="ts">
import ColorTick from '@/components/ui/ColorTick.vue';
import MovementBadge from '@/components/ui/MovementBadge.vue';
import type { HorseId } from '@/domain';
import type { StandingsView } from '@/stores/raceView';

/**
 * Compact program standings for the stable column: rank, horse and points.
 * Always lists all 20 horses (unraced ones last, muted), so it is exactly as
 * tall as the roster and switching views never shifts the layout. Per-round
 * placings and form live in the full table dialog and each row's label.
 */
defineProps<{ standings: StandingsView }>();
defineEmits<{ follow: [horseId: HorseId] }>();
</script>

<template>
  <div class="standings-list">
    <div class="standings-list__columns mono" aria-hidden="true">
      <span>#</span><span /><span /><span>HORSE</span><span class="is-right">PTS</span>
    </div>
    <ol class="standings-list__rows" aria-label="Program standings">
      <li v-for="row in standings.rows" :key="row.horseId">
        <button
          type="button"
          class="standings-list__row"
          :class="{ 'is-followed': row.followed, 'is-unraced': row.starts === 0 }"
          :aria-pressed="row.followed"
          :aria-label="row.description"
          :title="`${row.description}${row.form ? ` · form ${row.form}` : ''}`"
          @click="$emit('follow', row.horseId)"
        >
          <span class="standings-list__rank mono">{{ row.rank }}</span>
          <MovementBadge :movement="row.movement" />
          <ColorTick :color="row.starts === 0 ? 'var(--inactive-bg)' : row.color" />
          <span class="standings-list__name" :class="{ 'is-strong': row.followed }">{{
            row.name
          }}</span>
          <span class="standings-list__points mono">{{ row.points }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.standings-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.standings-list__columns,
.standings-list__row {
  display: grid;
  grid-template-columns: 22px 24px 4px minmax(0, 1fr) 28px;
  gap: 6px;
  align-items: center;
}

.standings-list__columns {
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

.standings-list__rows {
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

.standings-list__row {
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
  transition: background-color 0.15s;
}

.standings-list__row:hover {
  background-color: var(--row-hover);
}

.standings-list__row.is-followed {
  background-image: linear-gradient(var(--sel-bg), var(--sel-bg));
  box-shadow: inset 0 0 0 1px var(--sel-line);
}

.standings-list__row.is-followed:hover {
  background-image: linear-gradient(var(--row-hover-selected), var(--row-hover-selected));
}

.standings-list__rank {
  font-size: 11px;
  color: var(--muted);
}

.standings-list__name {
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.standings-list__name.is-strong {
  font-weight: 700;
}

.standings-list__points {
  font-size: 12px;
  font-weight: 700;
  text-align: right;
}

.is-unraced .standings-list__rank,
.is-unraced .standings-list__name,
.is-unraced .standings-list__points {
  color: var(--inactive-fg);
  font-weight: 400;
}
</style>
