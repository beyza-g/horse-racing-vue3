import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TabSwitch from './TabSwitch.vue';

const tabs = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

const mountTabs = (modelValue = 'a') =>
  mount(TabSwitch, {
    props: { tabs, modelValue, idPrefix: 'demo', label: 'Demo view' },
    attachTo: document.body,
  });

describe('TabSwitch', () => {
  it('follows the WAI-ARIA tabs pattern', () => {
    const wrapper = mountTabs('b');
    expect(wrapper.attributes('role')).toBe('tablist');
    expect(wrapper.attributes('aria-label')).toBe('Demo view');
    const buttons = wrapper.findAll('[role="tab"]');
    expect(buttons.map((b) => b.attributes('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(buttons.map((b) => b.attributes('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(buttons[1]!.attributes('aria-controls')).toBe('demo-panel-b');
    expect(buttons[1]!.attributes('id')).toBe('demo-tab-b');
    wrapper.unmount();
  });

  it('selects on click', async () => {
    const wrapper = mountTabs();
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['c']]);
    wrapper.unmount();
  });

  it('moves with arrow keys (wrapping), Home and End, and moves focus', async () => {
    const wrapper = mountTabs('a');
    const first = wrapper.findAll('[role="tab"]')[0]!;
    await first.trigger('keydown', { key: 'ArrowRight' });
    await first.trigger('keydown', { key: 'ArrowLeft' });
    await first.trigger('keydown', { key: 'End' });
    await first.trigger('keydown', { key: 'Home' });
    await first.trigger('keydown', { key: 'x' });
    expect(wrapper.emitted('update:modelValue')).toEqual([['b'], ['c'], ['c'], ['a']]);
    expect(document.activeElement?.id).toBe('demo-tab-a');
    wrapper.unmount();
  });
});
