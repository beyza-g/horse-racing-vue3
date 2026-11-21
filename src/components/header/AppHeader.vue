<script setup lang="ts">
import { computed } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import FollowChip from './FollowChip.vue';
import PlaybackButton from './PlaybackButton.vue';
import RoundProgress from './RoundProgress.vue';
import SpeedSelector from './SpeedSelector.vue';
import StatusIndicator from './StatusIndicator.vue';
import ThemeToggle from './ThemeToggle.vue';

const race = useRaceStore();
const preferences = usePreferencesStore();

const followed = computed(() => {
  const id = preferences.followedHorseId;
  return id === null ? undefined : race.horsesById.get(id);
});
</script>

<template>
  <header class="app-header">
    <h1 class="app-header__title">HORSE RACING</h1>
    <div class="app-header__status">
      <RoundProgress :segments="race.progress" />
      <StatusIndicator :status="race.status" />
      <FollowChip
        v-if="followed"
        :name="followed.name"
        :color="followed.color"
        @clear="preferences.clearFollow()"
      />
    </div>
    <div class="app-header__controls">
      <ThemeToggle :theme="preferences.theme" @toggle="preferences.toggleTheme()" />
      <AppButton
        :active="preferences.focusMode"
        :aria-pressed="preferences.focusMode"
        title="Focus mode (F): dims the panels around the track"
        @click="preferences.toggleFocus()"
      >
        Focus
      </AppButton>
      <AppButton
        class="app-header__grow"
        :variant="race.generatePrimary ? 'primary' : 'secondary'"
        data-action="generate"
        @click="race.requestNewProgram()"
      >
        Generate Program
      </AppButton>
      <SpeedSelector :model-value="preferences.speed" @update:model-value="preferences.setSpeed" />
      <PlaybackButton
        v-if="race.playbackControl.visible"
        class="app-header__grow"
        :control="race.playbackControl"
        @toggle="race.togglePlayback()"
      />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 24px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}

.app-header__title {
  margin: 0;
  flex: 1 1 auto;
  font-size: 25px;
  font-weight: 800;
  font-stretch: 74%;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
}

.app-header__status {
  flex: 1 1 300px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px 16px;
  min-width: 0;
  flex-wrap: wrap;
}

.app-header__controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  flex: 1 1 100%;
}

.app-header__grow {
  flex: 1 1 130px;
}

@media (min-width: 760px) {
  .app-header__title {
    flex: 0 0 auto;
  }

  .app-header__status {
    justify-content: center;
  }

  .app-header__controls {
    flex: 0 0 auto;
  }

  .app-header__grow {
    flex: 0 0 auto;
  }
}
</style>
