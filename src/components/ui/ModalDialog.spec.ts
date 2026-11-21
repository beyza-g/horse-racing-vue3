import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ModalDialog from './ModalDialog.vue';

const mountDialog = (dismissible: boolean) =>
  mount(ModalDialog, {
    props: { open: true, labelledby: 'title', dismissible },
    slots: { default: '<h2 id="title">Title</h2><p class="body">Body</p>' },
    global: { stubs: { teleport: true } },
    attachTo: document.body,
  });

describe('ModalDialog backdrop', () => {
  it('a dismissible dialog emits dismiss when press and release are both on the backdrop', async () => {
    const wrapper = mountDialog(true);
    const scrim = wrapper.get('.modal-scrim');
    await scrim.trigger('pointerdown');
    await scrim.trigger('click');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
    wrapper.unmount();
  });

  it('a drag that starts inside the panel and ends on the backdrop never dismisses', async () => {
    const wrapper = mountDialog(true);
    await wrapper.get('.body').trigger('pointerdown');
    await wrapper.get('.modal-scrim').trigger('click');
    expect(wrapper.emitted('dismiss')).toBeUndefined();
    wrapper.unmount();
  });

  it('clicks inside the panel never dismiss', async () => {
    const wrapper = mountDialog(true);
    const body = wrapper.get('.body');
    await body.trigger('pointerdown');
    await body.trigger('click');
    expect(wrapper.emitted('dismiss')).toBeUndefined();
    wrapper.unmount();
  });

  it('decision dialogs (not dismissible) ignore backdrop clicks', async () => {
    const wrapper = mountDialog(false);
    const scrim = wrapper.get('.modal-scrim');
    await scrim.trigger('pointerdown');
    await scrim.trigger('click');
    expect(wrapper.emitted('dismiss')).toBeUndefined();
    wrapper.unmount();
  });
});
