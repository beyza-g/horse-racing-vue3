<script setup lang="ts">
import IconClose from '@/components/ui/icons/IconClose.vue';

/** "Following <horse>" pill with a clear button. Presentational. */
defineProps<{ name: string; color: string }>();
defineEmits<{ clear: [] }>();
</script>

<template>
  <div class="follow-chip" :title="`Following ${name}`">
    <span class="follow-chip__dot" :style="{ background: color }" aria-hidden="true" />
    <span class="follow-chip__label">Following</span>
    <span class="follow-chip__name">{{ name }}</span>
    <button
      type="button"
      class="follow-chip__clear"
      title="Stop following (Esc)"
      aria-label="Stop following"
      @click="$emit('clear')"
    >
      <IconClose />
    </button>
  </div>
</template>

<style scoped>
.follow-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--control-h);
  padding: 0 4px 0 14px;
  border-radius: var(--radius-pill);
  /* Opaque: it floats over the page. */
  background: linear-gradient(var(--sel-bg), var(--sel-bg)), var(--panel);
  box-shadow:
    inset 0 0 0 1px var(--sel-line),
    0 6px 20px rgba(0, 0, 0, 0.22);
  max-width: 100%;
}

.follow-chip__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}

.follow-chip__label {
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
}

.follow-chip__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.follow-chip__clear {
  width: 28px;
  height: 28px;
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

.follow-chip__clear:hover {
  background-color: var(--hover-ring);
}
</style>
