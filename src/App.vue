<script setup lang="ts">
// M1 shell: proves the toolchain, fonts and tokens. Replaced by the real layout in M5.
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <span class="app-title">HORSE RACING</span>
    </header>
    <main class="app-main">
      <p class="app-placeholder">Project scaffold ready. The race UI arrives in milestone 5.</p>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
}

.app-header {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}

.app-title {
  font-size: 25px;
  font-weight: 800;
  font-stretch: 74%;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
}

.app-main {
  flex: 1;
  padding: var(--gap);
}

.app-placeholder {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}
</style>
