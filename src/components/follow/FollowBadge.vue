<script setup lang="ts">
import { computed } from 'vue';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import FollowChip from './FollowChip.vue';

/**
 * Container: the "Following <horse>" badge, fixed to the viewport's
 * bottom-right corner. It is out of the document flow, so following or
 * unfollowing never moves anything, and it sits outside the header and the
 * track, so it never covers the round, the runners or the distance markers.
 * The live region is always rendered (empty while idle) so announcements fire.
 */
const race = useRaceStore();
const preferences = usePreferencesStore();

const followed = computed(() => {
  const id = preferences.followedHorseId;
  return id === null ? undefined : race.horsesById.get(id);
});
</script>

<template>
  <div class="follow-badge" aria-live="polite" data-keep-selection>
    <Transition name="follow-badge">
      <FollowChip
        v-if="followed"
        :key="followed.id"
        :name="followed.name"
        :color="followed.color"
        @clear="preferences.clearFollow()"
      />
    </Transition>
  </div>
</template>

<style scoped>
.follow-badge {
  position: fixed;
  right: max(var(--float-inset), env(safe-area-inset-right));
  bottom: max(var(--float-inset), env(safe-area-inset-bottom));
  z-index: 50;
  max-width: min(340px, calc(100vw - 2 * var(--float-inset)));
  /* The empty region never blocks clicks on the page beneath it. */
  pointer-events: none;
}

/* Desktop: the grid fills the viewport, so the badge rests in the empty
   lower part of the Program panel, aligned with the panel's content edges. */
@media (min-width: 1180px) {
  .follow-badge {
    right: calc(var(--gap) + 12px);
    bottom: calc(var(--gap) + 12px);
    max-width: calc(272px - 24px);
  }
}

.follow-badge > * {
  pointer-events: auto;
}

.follow-badge-enter-active,
.follow-badge-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.follow-badge-leave-active {
  position: absolute;
  right: 0;
  bottom: 0;
}

.follow-badge-enter-from,
.follow-badge-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .follow-badge-enter-active,
  .follow-badge-leave-active {
    transition: opacity 0.12s linear;
  }

  .follow-badge-enter-from,
  .follow-badge-leave-to {
    transform: none;
  }
}
</style>
