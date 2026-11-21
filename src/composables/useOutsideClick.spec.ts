import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { isDismissClick, useOutsideClick } from './useOutsideClick';

function build(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isDismissClick', () => {
  it('dismisses on plain, non-interactive content', () => {
    const root = build('<section><h2 id="title">Stable</h2><p id="text">Hello</p></section>');
    expect(isDismissClick(root.querySelector('#title'))).toBe(true);
    expect(isDismissClick(root.querySelector('#text'))).toBe(true);
    expect(isDismissClick(root)).toBe(true);
  });

  it.each([
    '<button id="t">x</button>',
    '<button><span id="t">inside a button</span></button>',
    '<a href="#" id="t">link</a>',
    '<input id="t" />',
    '<div role="switch"><i id="t"></i></div>',
    '<div role="dialog"><p id="t">dialog text</p></div>',
    '<canvas id="t"></canvas>',
    '<div data-keep-selection><p id="t">opt-out</p></div>',
  ])('keeps the selection for %s', (html) => {
    const root = build(html);
    expect(isDismissClick(root.querySelector('#t'))).toBe(false);
  });

  it('ignores non-element targets', () => {
    expect(isDismissClick(null)).toBe(false);
    expect(isDismissClick(window)).toBe(false);
  });
});

describe('useOutsideClick', () => {
  function mountHost(enabled: () => boolean, onDismiss: () => void) {
    const Host = defineComponent({
      setup() {
        useOutsideClick(enabled, onDismiss);
        return () => h('div', [h('p', { id: 'plain' }, 'plain'), h('button', { id: 'btn' }, 'b')]);
      },
    });
    return mount(Host, { attachTo: document.body });
  }

  it('fires for plain clicks only while enabled', async () => {
    const onDismiss = vi.fn();
    let enabled = false;
    const wrapper = mountHost(() => enabled, onDismiss);
    await wrapper.get('#plain').trigger('click');
    expect(onDismiss).not.toHaveBeenCalled();
    enabled = true;
    await wrapper.get('#btn').trigger('click');
    expect(onDismiss).not.toHaveBeenCalled();
    await wrapper.get('#plain').trigger('click');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    document.body.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ignores secondary buttons and clicks that end a text selection', async () => {
    const onDismiss = vi.fn();
    const wrapper = mountHost(() => true, onDismiss);
    await wrapper.get('#plain').trigger('click', { button: 2 });
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'Plain' } as Selection);
    await wrapper.get('#plain').trigger('click');
    expect(onDismiss).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
