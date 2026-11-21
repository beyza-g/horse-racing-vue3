<script setup lang="ts">
import { computed } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import ColorTick from '@/components/ui/ColorTick.vue';
import IconClose from '@/components/ui/icons/IconClose.vue';
import MovementBadge from '@/components/ui/MovementBadge.vue';
import ModalDialog from '@/components/ui/ModalDialog.vue';
import { useRaceStore } from '@/stores/race';

/**
 * Full program standings: every horse's placing in every round, with points.
 * A real <table> (caption, scoped headers) inside a horizontally scrollable
 * frame, so narrow screens scroll the table, never the page. Points come
 * right after the horse and the rank and horse columns stay pinned, so the
 * total is always visible while the rounds scroll.
 *
 * A read-only viewer, so it is quick to leave: the top-right ✕, a backdrop
 * click and Esc all close it, back to wherever it was opened from (the track,
 * or the completion summary it is stacked on). The footer is kept for the
 * forward action only: "Generate new program" once the program is complete,
 * pinned while the table scrolls. Decision dialogs (completion, discard)
 * deliberately have neither ✕ nor backdrop dismissal. The table region takes
 * the initial focus, so Enter there never activates the ✕.
 */
const race = useRaceStore();
const view = computed(() => race.standings);
/** Opened from the completion summary, closing goes back to it rather than to the track. */
const closeLabel = computed(() =>
  race.standingsReturnToSummary ? 'Back to summary' : 'Close standings',
);
const subtitle = computed(() => {
  const n = view.value.officialRounds;
  if (n === 6) return 'Final standings after all six rounds';
  return n === 0 ? 'No round is official yet' : `After ${n} of 6 rounds`;
});
</script>

<template>
  <ModalDialog
    :open="race.standingsOpen"
    labelledby="standings-title"
    describedby="standings-subtitle"
    width="720px"
    initial-focus=".standings__frame"
    dismissible
    @dismiss="race.closeStandings()"
  >
    <div class="standings__head">
      <div class="standings__intro">
        <p class="standings__eyebrow mono">PROGRAM STANDINGS</p>
        <h2 id="standings-title" class="standings__title">Standings</h2>
        <p id="standings-subtitle" class="standings__subtitle">{{ subtitle }}</p>
      </div>
      <button
        type="button"
        class="standings__close"
        :aria-label="closeLabel"
        :title="`${closeLabel} (Esc)`"
        @click="race.closeStandings()"
      >
        <IconClose />
      </button>
    </div>

    <div class="standings__frame" role="region" aria-label="Standings table" tabindex="0">
      <table class="standings__table">
        <caption class="visually-hidden">
          Points and placing per round for every horse. 10, 8, 6, 5, 4, 3, 2 and 1 points for 1st to
          8th.
        </caption>
        <thead>
          <tr>
            <th scope="col" class="is-rank">#</th>
            <th scope="col" class="is-horse">Horse</th>
            <th scope="col" class="is-points">Pts</th>
            <th v-for="round in view.rounds" :key="round.label" scope="col" class="is-round">
              <abbr :title="round.title">{{ round.label }}</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in view.rows"
            :key="row.horseId"
            :class="{ 'is-unraced': row.starts === 0, 'is-followed': row.followed }"
          >
            <td class="is-rank mono">
              <span class="standings__rank">
                <span>{{ row.rank }}</span>
                <MovementBadge :movement="row.movement" />
              </span>
            </td>
            <th scope="row" class="is-horse">
              <span class="standings__horse">
                <ColorTick
                  :color="row.starts === 0 ? 'var(--inactive-bg)' : row.color"
                  :height="13"
                />
                <span class="standings__name">{{ row.name }}</span>
              </span>
            </th>
            <td class="is-points mono">{{ row.points }}</td>
            <td v-for="(cell, index) in row.cells" :key="index" class="is-round">
              <span
                v-if="cell.state === 'placed'"
                class="standings__place mono"
                :class="cell.medal ? ['is-medal', `is-${cell.medal}`] : null"
                >{{ cell.label }}</span
              >
              <span
                v-else-if="cell.state === 'pending'"
                class="standings__pending"
                title="Entered, not run yet"
                ><span aria-hidden="true">·</span
                ><span class="visually-hidden">entered, not run yet</span></span
              >
              <span v-else class="visually-hidden">not running</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="standings__footer">
      <p class="standings__note">
        10-8-6-5-4-3-2-1 points for 1st to 8th. Ties go to more wins, then more seconds, and so on;
        horses still level share a rank (=). A dot marks a round the horse is entered in but has not
        run yet.
      </p>
    </div>
    <!-- A direct child of the scrolling panel, so it can stay pinned. -->
    <div v-if="race.phase === 'complete'" class="standings__actions">
      <AppButton
        variant="primary"
        class="standings__action"
        data-action="generate"
        @click="race.requestNewProgram()"
      >
        Generate new program
      </AppButton>
    </div>
  </ModalDialog>
</template>

<style scoped>
.standings__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.standings__intro {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.standings__close {
  width: 32px;
  height: 32px;
  flex: none;
  border: none;
  border-radius: 50%;
  background-color: var(--chip-strong);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.standings__close:hover {
  background-color: var(--hover-ring);
}

.standings__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--accent-text);
}

.standings__title {
  margin: 0;
  font-size: 24px;
  font-weight: var(--title-w);
  font-stretch: 80%;
  line-height: 1.1;
}

.standings__subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.standings__frame {
  overflow-x: auto;
  border-top: 1px solid var(--line-strong);
}

.standings__table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 13px;
}

.standings__table th,
.standings__table td {
  height: 28px;
  padding: 0 6px;
  border-bottom: 1px solid var(--line);
  text-align: center;
  font-weight: 400;
  white-space: nowrap;
}

.standings__table thead th {
  height: 30px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: var(--label-w);
  letter-spacing: 0.1em;
  color: var(--faint);
  text-transform: uppercase;
}

.standings__table abbr {
  text-decoration: none;
}

.standings__table .is-rank {
  width: 58px;
  min-width: 58px;
  text-align: left;
  color: var(--muted);
  font-size: 11px;
}

.standings__table .is-horse {
  text-align: left;
}

/* Pinned while the round columns scroll on narrow screens. */
.standings__table .is-rank,
.standings__table .is-horse,
.standings__table .is-points {
  position: sticky;
  z-index: 1;
  background: var(--panel);
}

.standings__table .is-rank {
  left: 0;
}

.standings__table .is-horse {
  left: 58px;
  width: 128px;
  min-width: 128px;
  max-width: 128px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.standings__table .is-points {
  left: 186px;
  box-shadow: inset -1px 0 0 var(--line);
}

tbody tr.is-followed .is-rank,
tbody tr.is-followed .is-horse,
tbody tr.is-followed .is-points {
  background: linear-gradient(var(--sel-bg), var(--sel-bg)), var(--panel);
}

.standings__table .is-round {
  width: 50px;
}

.standings__table .is-points {
  width: 48px;
  min-width: 48px;
  padding-right: 14px;
  text-align: right;
  font-weight: 700;
}

.standings__table thead .is-points {
  font-weight: var(--label-w);
}

.standings__rank {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.standings__rank > span:first-child {
  min-width: 26px;
}

.standings__horse {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.standings__name {
  font-weight: 500;
}

.is-followed .standings__name {
  font-weight: 700;
}

tbody tr.is-followed {
  background: var(--sel-bg);
}

.standings__place {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 18px;
  border-radius: 9px;
  font-size: 11px;
  color: var(--muted);
}

.standings__place.is-medal {
  font-weight: 700;
  color: var(--medal-ink);
  box-shadow: inset 0 0 0 1px var(--medal-ring);
}

.standings__place.is-gold {
  background: var(--medal-gold);
}

.standings__place.is-silver {
  background: var(--medal-silver);
}

.standings__place.is-bronze {
  background: var(--medal-bronze);
}

.standings__pending {
  color: var(--faint);
  font-weight: 700;
}

.is-unraced .is-rank,
.is-unraced .standings__name,
.is-unraced .is-points {
  color: var(--inactive-fg);
  font-weight: 400;
}

.standings__footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.standings__note {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--muted);
}

/*
 * The forward action, right-aligned (full width on phones). Pinned to the
 * bottom of the scrolling dialog (its padding is 18 px) and above the pinned
 * table columns, so it stays in view while the table scrolls.
 */
.standings__actions {
  display: flex;
  justify-content: flex-end;
  position: sticky;
  bottom: -18px;
  z-index: 2;
  margin: -10px 0 -18px;
  padding: 10px 0 18px;
  background: var(--panel);
}

.standings__action {
  flex: 1 1 200px;
  max-width: 220px;
  padding: 0 16px;
}

@media (max-width: 520px) {
  .standings__action {
    max-width: none;
  }
}
</style>
