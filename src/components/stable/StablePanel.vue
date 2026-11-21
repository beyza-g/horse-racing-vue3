<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import PanelCard from '@/components/ui/PanelCard.vue';
import TabSwitch from '@/components/ui/TabSwitch.vue';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import ConditionLegend from './ConditionLegend.vue';
import StableTable from './StableTable.vue';
import StandingsList from './StandingsList.vue';

const race = useRaceStore();
const preferences = usePreferencesStore();

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'standings', label: 'Standings' },
] as const;
/** Which view of the 20 horses is shown. Local UI state; both views have the same height. */
const view = ref<string>('roster');
</script>

<template>
  <PanelCard title="Stable" as="aside" heading-id="stable-heading" :dimmed="preferences.focusMode">
    <template #actions>
      <TabSwitch v-model="view" :tabs="TABS" id-prefix="stable" label="Stable view" />
    </template>
    <div
      v-show="view === 'roster'"
      id="stable-panel-roster"
      class="stable-panel__view"
      role="tabpanel"
      aria-labelledby="stable-tab-roster"
    >
      <StableTable :rows="race.stable" @follow="preferences.toggleFollow" />
      <div class="stable-panel__footer">
        <ConditionLegend />
      </div>
    </div>
    <div
      v-show="view === 'standings'"
      id="stable-panel-standings"
      class="stable-panel__view"
      role="tabpanel"
      aria-labelledby="stable-tab-standings"
    >
      <StandingsList :standings="race.standings" @follow="preferences.toggleFollow" />
      <div class="stable-panel__footer stable-panel__footer--standings">
        <p class="stable-panel__scoring">
          <span>{{
            race.standings.hasResults
              ? `After ${race.standings.officialRounds} of 6 rounds`
              : 'No official round yet'
          }}</span>
          <span class="stable-panel__scale mono">Pts 10-8-6-5-4-3-2-1</span>
        </p>
        <AppButton
          class="stable-panel__table"
          :disabled="!race.hasProgram"
          @click="race.openStandings()"
        >
          Full table
        </AppButton>
      </div>
    </div>
  </PanelCard>
</template>

<style scoped>
.stable-panel__view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Both footers reserve the same height, so switching views never shifts layout. */
.stable-panel__footer {
  min-height: 46px;
  display: flex;
  align-items: stretch;
  border-top: 1px solid var(--line);
}

.stable-panel__footer :deep(.condition-legend) {
  border-top: none;
  flex: 1;
}

.stable-panel__footer--standings {
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 2px 0 6px;
}

.stable-panel__scoring {
  margin: 0;
  display: flex;
  flex-direction: column;
  font-size: 11px;
  line-height: 1.4;
  color: var(--muted);
  white-space: nowrap;
}

.stable-panel__scale {
  font-size: 10px;
  color: var(--faint);
}

.stable-panel__table {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  flex: none;
}
</style>
