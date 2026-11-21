import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from './App.vue';

describe('App shell', () => {
  it('renders the product title', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('HORSE RACING');
  });
});
