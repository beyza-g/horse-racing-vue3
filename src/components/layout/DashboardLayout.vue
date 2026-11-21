<script setup lang="ts">
/**
 * Page structure only: header plus a responsive grid with named areas.
 * Desktop (>= 1180px): stable | track | program over stable | results | program.
 * Tablet (>= 760px): track, results, then program and stable side by side.
 * Mobile: one column.
 */
</script>

<template>
  <div class="dashboard">
    <slot name="header" />
    <main class="dashboard__main">
      <div class="dashboard__area dashboard__area--track"><slot name="track" /></div>
      <div class="dashboard__area dashboard__area--results"><slot name="results" /></div>
      <div class="dashboard__area dashboard__area--program"><slot name="program" /></div>
      <div class="dashboard__area dashboard__area--stable"><slot name="stable" /></div>
    </main>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  transition:
    background 0.35s,
    color 0.35s;
}

.dashboard__main {
  flex: 1;
  display: grid;
  gap: var(--gap);
  /* The page scrolls below 1180 px: the bottom clearance lets the floating
     follow badge rest below the last panel instead of covering it. It is
     always there, so following never changes the page height. */
  padding: 10px 10px var(--float-clearance);
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'track' 'results' 'program' 'stable';
}

.dashboard__area {
  min-width: 0;
  min-height: 0;
}

.dashboard__area--track {
  grid-area: track;
  height: 380px;
}

.dashboard__area--results {
  grid-area: results;
  height: 590px;
}

.dashboard__area--program {
  grid-area: program;
}

.dashboard__area--stable {
  grid-area: stable;
}

@media (min-width: 760px) {
  .dashboard__main {
    padding: var(--gap) var(--gap) var(--float-clearance);
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: 'track track' 'results results' 'program stable';
  }

  .dashboard__area--track {
    height: 440px;
  }

  .dashboard__area--results {
    height: 336px;
  }
}

@media (min-width: 1180px) {
  .dashboard {
    height: 100vh;
    overflow: auto;
  }

  .dashboard__main {
    /* Fixed-height grid: the badge rests inside the Program panel instead. */
    padding: var(--gap);
    min-height: 700px;
    grid-template-columns: var(--stable-col) minmax(0, 1fr) var(--program-col);
    grid-template-rows: minmax(0, 1fr) 336px;
    grid-template-areas: 'stable track program' 'stable results program';
  }

  .dashboard__area--track,
  .dashboard__area--results {
    height: auto;
  }
}
</style>
