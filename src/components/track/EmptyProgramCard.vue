<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue';

defineEmits<{ generate: [] }>();
</script>

<template>
  <div class="empty-program">
    <div class="empty-program__card">
      <h2 class="empty-program__title">No program yet</h2>
      <p class="empty-program__text">
        Draw ten runners for each of the six rounds to set the card.
      </p>
      <AppButton
        variant="primary"
        size="lg"
        class="empty-program__action"
        data-action="generate"
        @click="$emit('generate')"
      >
        Generate Program
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.empty-program {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  pointer-events: none;
}

.empty-program__card {
  pointer-events: auto;
  max-width: 340px;
  padding: 24px 28px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--line-strong);
  background: var(--panel);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.empty-program__title {
  margin: 0;
  font-size: 22px;
  font-weight: var(--title-w);
  font-stretch: 80%;
}

.empty-program__text {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.45;
  text-wrap: pretty;
}

.empty-program__action {
  margin-top: 6px;
}
</style>
