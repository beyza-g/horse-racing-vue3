<script setup lang="ts">
import ColorTick from '@/components/ui/ColorTick.vue';
import StatusPill from '@/components/ui/StatusPill.vue';
import type { HorseId } from '@/domain';
import type { BoardView } from '@/viewModels';

defineProps<{ board: BoardView }>();
defineEmits<{ follow: [horseId: HorseId]; backToLive: [] }>();
</script>

<template>
  <div class="leaderboard">
    <div class="leaderboard__head">
      <h2 class="leaderboard__title">{{ board.title }}</h2>
      <span class="leaderboard__distance">{{ board.distance }}</span>
      <StatusPill
        v-if="board.pill"
        class="leaderboard__pill"
        :label="board.pill.label"
        :tone="board.pill.tone"
      />
      <button
        v-if="board.showBackToLive"
        type="button"
        class="leaderboard__back"
        title="Return to the current round"
        @click="$emit('backToLive')"
      >
        Back to live
      </button>
    </div>
    <ol class="leaderboard__rows" :aria-label="`${board.title} standings`">
      <li v-if="board.rows.length === 0" class="leaderboard__empty">
        Rankings and finish times appear here once a program is generated.
      </li>
      <li
        v-for="row in board.rows"
        :key="row.horseId"
        class="leaderboard__row"
        :style="{ transform: `translateY(${row.top}px)` }"
      >
        <button
          type="button"
          class="leaderboard__button"
          :class="{ 'is-followed': row.followed }"
          :aria-pressed="row.followed"
          :title="`${row.name}${row.time ? ` · ${row.time}` : ''} · ${row.followed ? 'click to stop following' : 'click to follow'}`"
          @click="$emit('follow', row.horseId)"
        >
          <span
            class="leaderboard__position mono"
            :class="row.medal ? ['is-medal', `is-${row.medal}`] : null"
            >{{ row.position }}</span
          >
          <ColorTick :color="row.color" />
          <span class="leaderboard__name" :class="{ 'is-strong': row.emphasized }">{{
            row.name
          }}</span>
          <span class="leaderboard__time mono" :class="{ 'is-final': row.finished }">{{
            row.time
          }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.leaderboard {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.leaderboard__head {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  margin-bottom: 6px;
}

.leaderboard__title {
  margin: 0;
  font-size: 19px;
  font-weight: var(--title-w);
  font-stretch: 80%;
  white-space: nowrap;
}

.leaderboard__distance {
  font-size: 14px;
  color: var(--muted);
  white-space: nowrap;
}

.leaderboard__pill {
  margin-left: auto;
}

.leaderboard__back {
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  border: none;
  background-color: var(--accent);
  color: var(--on-accent);
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.leaderboard__rows {
  position: relative;
  height: 262px;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line-strong);
  background-image: repeating-linear-gradient(to bottom, transparent 0 25px, var(--line) 25px 26px);
}

.leaderboard__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  font-size: 14px;
  color: var(--faint);
}

.leaderboard__row {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--row-h);
  transition: transform 0.5s var(--ease-out);
}

.leaderboard__button {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 34px 4px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 0 8px 0 6px;
  border: none;
  border-radius: 5px;
  background-color: transparent;
  color: var(--text);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: background-color 0.15s;
}

.leaderboard__button:hover {
  background-color: var(--row-hover);
}

.leaderboard__button.is-followed {
  background-image: linear-gradient(var(--sel-bg), var(--sel-bg));
  box-shadow: inset 0 0 0 1px var(--sel-line);
}

.leaderboard__button.is-followed:hover {
  background-image: linear-gradient(var(--row-hover-selected), var(--row-hover-selected));
}

/* Every position label has the same fixed box, so medals never shift alignment. */
.leaderboard__position {
  width: 32px;
  height: 18px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--faint);
  transition:
    background-color 0.3s,
    color 0.3s;
}

.leaderboard__position.is-medal {
  font-weight: 700;
  color: var(--medal-ink);
  box-shadow: inset 0 0 0 1px var(--medal-ring);
}

.leaderboard__position.is-gold {
  background: var(--medal-gold);
}

.leaderboard__position.is-silver {
  background: var(--medal-silver);
}

.leaderboard__position.is-bronze {
  background: var(--medal-bronze);
}

.leaderboard__name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.leaderboard__name.is-strong {
  font-weight: 700;
}

.leaderboard__time {
  font-size: 12px;
  color: var(--faint);
}

.leaderboard__time.is-final {
  font-weight: 600;
  color: var(--text);
}
</style>
