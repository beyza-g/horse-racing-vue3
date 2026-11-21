import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { useFocusTrap } from './useFocusTrap';

function setup() {
  const outside = document.createElement('button');
  outside.textContent = 'outside';
  const background = document.createElement('div');
  background.append(outside);
  document.body.append(background);
  outside.focus();

  const active = ref(false);
  const Host = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null);
      const primary = ref<HTMLElement | null>(null);
      useFocusTrap(root, active, { initialFocus: primary, inertTargets: () => [background] });
      return () =>
        h('div', { ref: root }, [
          h('button', { id: 'first' }, 'first'),
          h('button', { id: 'primary', ref: primary }, 'primary'),
          h('button', { id: 'last' }, 'last'),
        ]);
    },
  });
  const wrapper = mount(Host, { attachTo: document.body });
  return { wrapper, active, outside, background };
}

const tab = (shiftKey = false) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true }));

describe('useFocusTrap', () => {
  it('focuses the initial element, inerts the background and restores focus', async () => {
    const { wrapper, active, outside, background } = setup();
    active.value = true;
    await nextTick();
    await nextTick();
    expect(document.activeElement?.id).toBe('primary');
    expect(background.hasAttribute('inert')).toBe(true);
    active.value = false;
    await nextTick();
    expect(background.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(outside);
    wrapper.unmount();
    background.remove();
  });

  it('wraps Tab and Shift+Tab inside the container', async () => {
    const { wrapper, active, background } = setup();
    active.value = true;
    await nextTick();
    await nextTick();
    (wrapper.find('#last').element as HTMLElement).focus();
    tab();
    expect(document.activeElement?.id).toBe('first');
    tab(true);
    expect(document.activeElement?.id).toBe('last');
    wrapper.unmount();
    expect(background.hasAttribute('inert')).toBe(false);
    background.remove();
  });
});
