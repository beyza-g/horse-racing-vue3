<script setup lang="ts">
import IconClose from '@/components/ui/icons/IconClose.vue';

defineProps<{ name: string; color: string }>();
defineEmits<{ clear: [] }>();
</script>

<template>
  <div class="follow-chip">
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
  height: 30px;
  padding: 0 3px 0 10px;
  border-radius: var(--radius-pill);
  background: var(--sel-bg);
  box-shadow: inset 0 0 0 1px var(--sel-line);
  max-width: 100%;
}

.follow-chip__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}

.follow-chip__label {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
}

.follow-chip__name {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.follow-chip__clear {
  width: 24px;
  height: 24px;
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
