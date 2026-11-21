import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import App from './App.vue';
import { usePreferencesStore } from './stores/preferences';
import { useRaceStore } from './stores/race';

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  // The render loop is driven explicitly through the store in these tests.
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  setActivePinia(createPinia());
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function mountApp() {
  const host = document.createElement('div');
  host.id = 'app';
  document.body.append(host);
  const race = useRaceStore();
  race.initialize(42);
  wrapper = mount(App, { attachTo: host });
  return { wrapper, race, prefs: usePreferencesStore() };
}

const press = async (key: string, code = '') => {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }),
  );
  await nextTick();
};

const button = (w: VueWrapper, text: string) => {
  const match = w.findAll('button').find((b) => b.text().trim() === text);
  if (match === undefined) throw new Error(`No button "${text}"`);
  return match;
};

async function playToCompletion(race: ReturnType<typeof useRaceStore>) {
  usePreferencesStore().setSpeed(4);
  race.togglePlayback();
  for (let i = 0; i < 100_000 && race.phase !== 'complete'; i++) race.advance(1 / 60);
  await nextTick();
  await nextTick();
}

describe('App', () => {
  it('starts with no program: empty track card, disabled Start, Generate as primary', () => {
    const { wrapper: w } = mountApp();
    expect(w.text()).toContain('HORSE RACING');
    expect(w.text()).toContain('No program yet');
    expect(button(w, 'Start').attributes('disabled')).toBeDefined();
    expect(w.text()).toContain('No program');
    expect(w.findAll('.stable-table__row')).toHaveLength(20);
  });

  it('generates a program from the empty card and enables Start', async () => {
    const { wrapper: w, race } = mountApp();
    await w.find('.empty-program button').trigger('click');
    expect(race.phase).toBe('ready');
    expect(w.text()).not.toContain('No program yet');
    expect(button(w, 'Start').attributes('disabled')).toBeUndefined();
    expect(w.findAll('.round-card__row')).toHaveLength(10);
  });

  it('keyboard: Space starts and pauses, F focus, T theme, 1/2/4 speed, Esc clears follow then focus', async () => {
    const { wrapper: w, race, prefs } = mountApp();
    await press(' ', 'Space');
    expect(race.phase).toBe('idle');
    race.generateProgram();
    await press(' ', 'Space');
    expect(race.phase).toBe('countdown');
    await press(' ', 'Space');
    expect(race.paused).toBe(true);
    expect(button(w, 'Resume').exists()).toBe(true);
    await press('4');
    expect(prefs.speed).toBe(4);
    await press('3');
    expect(prefs.speed).toBe(4);
    await press('t');
    expect(document.documentElement.dataset['theme']).toBe('light');
    await press('f');
    expect(prefs.focusMode).toBe(true);
    expect(w.find('.panel-card.is-dimmed').exists()).toBe(true);
    prefs.toggleFollow(3);
    await press('Escape');
    expect(prefs.followedHorseId).toBeNull();
    expect(prefs.focusMode).toBe(true);
    await press('Escape');
    expect(prefs.focusMode).toBe(false);
  });

  it('following a horse from the stable shows the chip, which clears it', async () => {
    const { wrapper: w, prefs } = mountApp();
    await w.findAll('.stable-table__row')[2]!.trigger('click');
    expect(prefs.followedHorseId).toBe(3);
    expect(w.find('.follow-chip').exists()).toBe(true);
    await w.find('.follow-chip__clear').trigger('click');
    expect(prefs.followedHorseId).toBeNull();
    expect(w.find('.follow-chip').exists()).toBe(false);
  });

  it('regenerating mid-race resets to round 1 at the gates', async () => {
    const { wrapper: w, race } = mountApp();
    race.generateProgram();
    race.togglePlayback();
    for (let i = 0; i < 400; i++) race.advance(1 / 60);
    expect(race.phase).toBe('running');
    await button(w, 'Generate Program').trigger('click');
    expect(race.phase).toBe('ready');
    expect(race.results).toEqual([]);
    expect(button(w, 'Start').exists()).toBe(true);
  });

  describe('completion', () => {
    it('opens a blocking dialog, hides Start and inerts the page', async () => {
      const { wrapper: w, race } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
      expect(dialog?.textContent).toContain('All six rounds are official');
      expect(document.querySelectorAll('.complete__winner')).toHaveLength(6);
      const times = [...document.querySelectorAll('.complete__time')].map((el) =>
        el.textContent.trim(),
      );
      for (const time of times) expect(time).toMatch(/^\d:\d{2}\.\d{2}$/);
      expect(times[0]! < times[5]!).toBe(true);
      expect(document.getElementById('app')?.hasAttribute('inert')).toBe(true);
      expect(w.findAll('button').some((b) => b.text().trim() === 'Start')).toBe(false);
      expect(document.activeElement?.textContent.trim()).toBe('Generate new program');
    });

    it('ignores other shortcuts while open; Escape views the track', async () => {
      const { race, prefs } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      await press('t');
      await press('f');
      await press(' ', 'Space');
      expect(prefs.theme).toBe('dark');
      expect(prefs.focusMode).toBe(false);
      expect(race.phase).toBe('complete');
      await press('Escape');
      await nextTick();
      expect(race.completionOpen).toBe(false);
      expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false);
      await press(' ', 'Space');
      expect(race.phase).toBe('complete');
    });

    it('Enter starts a new program (the single new-program path)', async () => {
      const { race } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      await press('Enter');
      expect(race.phase).toBe('ready');
      expect(race.completionOpen).toBe(false);
    });

    it('the dialog buttons generate or dismiss', async () => {
      const { race } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      const buttons = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')];
      buttons.find((b) => b.textContent.trim() === 'View track')?.click();
      await nextTick();
      expect(race.completionOpen).toBe(false);
      expect(race.phase).toBe('complete');
    });
  });
});
