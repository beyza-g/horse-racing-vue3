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

  describe('regenerating mid-race', () => {
    async function midRace() {
      const ctx = mountApp();
      ctx.race.generateProgram();
      ctx.race.togglePlayback();
      for (let i = 0; i < 400; i++) ctx.race.advance(1 / 60);
      expect(ctx.race.phase).toBe('running');
      await button(ctx.wrapper, 'Generate Program').trigger('click');
      await nextTick();
      await nextTick();
      return ctx;
    }
    const dialog = () => document.querySelector('[role="dialog"]');
    const dialogButton = (text: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
        (b) => b.textContent.trim() === text,
      )!;

    it('asks first, pauses the race and focuses the safe choice', async () => {
      const { race } = await midRace();
      expect(race.confirmRegenerateOpen).toBe(true);
      expect(race.paused).toBe(true);
      expect(race.phase).toBe('running');
      expect(dialog()?.textContent).toContain('Round 1 in progress will be discarded');
      expect(dialog()?.getAttribute('aria-describedby')).toBe('regenerate-description');
      expect(document.activeElement?.textContent.trim()).toBe('Keep this program');
      expect(document.getElementById('app')?.hasAttribute('inert')).toBe(true);
    });

    it('Keep this program resumes exactly where it was', async () => {
      const { race } = await midRace();
      const ticks = race.getDirector().race!.tickCount;
      dialogButton('Keep this program').click();
      await nextTick();
      expect(race.confirmRegenerateOpen).toBe(false);
      expect(race.paused).toBe(false);
      expect(race.getDirector().race!.tickCount).toBe(ticks);
    });

    it('Escape cancels; Enter outside a button never confirms', async () => {
      const { race } = await midRace();
      await press('Enter');
      expect(race.confirmRegenerateOpen).toBe(true);
      expect(race.phase).toBe('running');
      await press('Escape');
      expect(race.confirmRegenerateOpen).toBe(false);
      expect(race.paused).toBe(false);
    });

    it('a race paused by the user stays paused after cancelling', () => {
      const { race } = mountApp();
      race.generateProgram();
      race.togglePlayback();
      for (let i = 0; i < 400; i++) race.advance(1 / 60);
      race.togglePlayback();
      race.requestNewProgram();
      race.cancelNewProgram();
      expect(race.paused).toBe(true);
    });

    it('Discard and generate resets to round 1 at the gates', async () => {
      const { wrapper: w, race } = await midRace();
      dialogButton('Discard and generate').click();
      await nextTick();
      expect(race.phase).toBe('ready');
      expect(race.results).toEqual([]);
      expect(race.confirmRegenerateOpen).toBe(false);
      expect(button(w, 'Start').exists()).toBe(true);
    });
  });

  describe('starting from the track', () => {
    it('shows a Start race card at the gates, focused after generating', async () => {
      const { wrapper: w, race } = mountApp();
      await w.find('.empty-program button').trigger('click');
      await nextTick();
      const start = w.find('.ready-card button');
      expect(start.exists()).toBe(true);
      expect(start.attributes('aria-label')).toBe('Start round 1');
      expect(w.find('.ready-card').text()).toContain('ROUND 1 · 1200M');
      expect(document.activeElement).toBe(start.element);
      await start.trigger('click');
      expect(race.phase).toBe('countdown');
      expect(w.find('.ready-card').exists()).toBe(false);
    });

    it('does not steal focus from an unrelated control', async () => {
      const { wrapper: w, race } = mountApp();
      const speed = w.findAll('.speed-selector__option')[1]!.element as HTMLButtonElement;
      speed.focus();
      race.generateProgram();
      await nextTick();
      expect(w.find('.ready-card').exists()).toBe(true);
      expect(document.activeElement).toBe(speed);
    });

    it('generating at the gates or after completion never asks', () => {
      const { race } = mountApp();
      race.generateProgram();
      race.requestNewProgram();
      expect(race.confirmRegenerateOpen).toBe(false);
      expect(race.phase).toBe('ready');
    });
  });

  describe('standings', () => {
    it('switches the stable between roster and standings', async () => {
      const { wrapper: w } = mountApp();
      const tab = w.get('#stable-tab-standings');
      await tab.trigger('click');
      expect(tab.attributes('aria-selected')).toBe('true');
      expect(w.get('#stable-panel-standings').isVisible()).toBe(true);
      expect(w.get('#stable-panel-roster').isVisible()).toBe(false);
      expect(w.findAll('.standings-list__row')).toHaveLength(20);
      expect(w.findAll('.stable-table__row')).toHaveLength(20);
    });

    it('keeps the standings footer to one line of context and a dialog trigger', async () => {
      const { wrapper: w, race } = mountApp();
      await w.get('#stable-tab-standings').trigger('click');
      const footer = w.get('.stable-panel__footer--standings');
      const button = footer.get('button');
      expect(footer.get('.stable-panel__scoring').text()).toBe('No official round yet');
      // The scoring rule is explained in the dialog, not repeated here.
      expect(footer.text()).not.toContain('10-8-6');
      expect(button.text()).toBe('Full table');
      expect(button.attributes('aria-haspopup')).toBe('dialog');
      expect(button.attributes('disabled')).toBeDefined();
      race.generateProgram();
      await nextTick();
      expect(button.attributes('disabled')).toBeUndefined();
    });

    it('opens the full table, closes with Escape and restores focus', async () => {
      const { wrapper: w, race } = mountApp();
      race.generateProgram();
      await nextTick();
      await w.get('#stable-tab-standings').trigger('click');
      const fullTable = w.get('.stable-panel__table');
      (fullTable.element as HTMLElement).focus();
      await fullTable.trigger('click');
      await nextTick();
      await nextTick();
      const dialog = document.querySelector('[role="dialog"]')!;
      expect(dialog.getAttribute('aria-labelledby')).toBe('standings-title');
      expect(dialog.querySelector('caption')?.textContent).toContain(
        'Points and placing per round',
      );
      expect(dialog.querySelectorAll('tbody tr')).toHaveLength(20);
      expect(dialog.querySelectorAll('thead th[scope="col"]')).toHaveLength(9);
      expect(dialog.querySelectorAll('tbody th[scope="row"]')).toHaveLength(20);
      // The table region takes focus, so Enter never activates the close button.
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Standings table');
      await press('Escape');
      await nextTick();
      expect(race.standingsOpen).toBe(false);
      expect(document.activeElement).toBe(fullTable.element);
    });

    const dialogButton = (text: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
        (b) => b.textContent.trim() === text,
      )!;
    const settle = async () => {
      await nextTick();
      await nextTick();
    };

    it('the completion summary links to the final standings', async () => {
      const { race } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      dialogButton('Final standings').click();
      await settle();
      expect(race.completionOpen).toBe(false);
      const dialog = document.querySelector('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Final standings after all six rounds');
      const points = [...dialog.querySelectorAll('tbody td.is-points')].map((td) =>
        Number(td.textContent),
      );
      expect(points.reduce((a, b) => a + b, 0)).toBe(234);
      // Stacked on the summary, the top-right close goes back to it; the footer
      // holds only the forward action.
      expect(dialog.querySelector('.standings__close')?.getAttribute('aria-label')).toBe(
        'Back to summary',
      );
      expect(
        [...dialog.querySelectorAll('.standings__actions button')].map((b) => b.textContent.trim()),
      ).toEqual(['Generate new program']);
    });

    it('Enter in the final standings starts a new program', async () => {
      const { race } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      dialogButton('Final standings').click();
      await settle();
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Standings table');
      await press('Enter');
      expect(race.phase).toBe('ready');
      expect(race.standingsOpen).toBe(false);
      expect(race.completionOpen).toBe(false);
    });

    it('mid-program the standings close from the corner or the backdrop; Enter does nothing', async () => {
      const { wrapper: w, race } = mountApp();
      race.generateProgram();
      await nextTick();
      await w.get('#stable-tab-standings').trigger('click');
      await w.get('.stable-panel__table').trigger('click');
      await settle();
      const dialog = document.querySelector('[role="dialog"]')!;
      expect(dialog.querySelector('.standings__close')?.getAttribute('aria-label')).toBe(
        'Close standings',
      );
      expect(dialog.querySelector('.standings__actions')).toBeNull();
      await press('Enter');
      expect(race.standingsOpen).toBe(true);
      expect(race.phase).toBe('ready');
      const scrim = document.querySelector<HTMLElement>('.modal-scrim')!;
      scrim.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      scrim.click();
      await settle();
      expect(race.standingsOpen).toBe(false);
    });

    it('closing the final standings returns to the summary, focused where it left off', async () => {
      const { race } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      const firstReveal = document.querySelector<HTMLElement>('.modal-scrim')!;
      expect(firstReveal.style.getPropertyValue('--reveal-delay')).toBe('0.9s');
      dialogButton('Final standings').click();
      await settle();
      await press('Escape');
      await settle();
      expect(race.completionOpen).toBe(true);
      expect(race.completionDismissed).toBe(false);
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
        'All six rounds are official',
      );
      expect(document.activeElement?.textContent.trim()).toBe('Final standings');
      const again = document.querySelector<HTMLElement>('.modal-scrim')!;
      expect(again.style.getPropertyValue('--reveal-delay')).toBe('0s');
    });

    it('the completion summary is a decision: a backdrop click never dismisses it', async () => {
      const { race } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      const scrim = document.querySelector<HTMLElement>('.modal-scrim')!;
      scrim.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      scrim.click();
      await settle();
      expect(race.completionOpen).toBe(true);
    });

    it('a backdrop click on the final standings returns to the summary', async () => {
      const { race } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      dialogButton('Final standings').click();
      await settle();
      const scrim = document.querySelector<HTMLElement>('.modal-scrim')!;
      scrim.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      scrim.click();
      await settle();
      expect(race.standingsOpen).toBe(false);
      expect(race.completionOpen).toBe(true);
    });

    it('Back to summary and Generate new program work from the standings', async () => {
      const { race } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      dialogButton('Final standings').click();
      await settle();
      document.querySelector<HTMLButtonElement>('[aria-label="Back to summary"]')!.click();
      await settle();
      expect(race.completionOpen).toBe(true);
      dialogButton('Final standings').click();
      await settle();
      dialogButton('Generate new program').click();
      await settle();
      expect(race.phase).toBe('ready');
      expect(race.standingsOpen).toBe(false);
      expect(race.completionOpen).toBe(false);
    });

    it('lays out the summary actions as one primary and two equal secondary buttons', async () => {
      const { race } = mountApp();
      race.generateProgram();
      await playToCompletion(race);
      const actions = document.querySelector('.complete__actions')!;
      expect(actions.querySelector(':scope > .app-button--primary')?.textContent.trim()).toBe(
        'Generate new program',
      );
      const secondary = [...actions.querySelectorAll('.complete__secondary > button')];
      expect(secondary.map((b) => b.textContent.trim())).toEqual(['Final standings', 'View track']);
      expect(secondary.every((b) => b.classList.contains('app-button--secondary'))).toBe(true);
    });
  });

  describe('results panel', () => {
    it('inspects a finished round, returns to live, and follows from the board', async () => {
      const { wrapper: w, race, prefs } = mountApp();
      prefs.setSpeed(4);
      race.generateProgram();
      race.togglePlayback();
      for (let i = 0; i < 200_000 && !(race.roundIndex === 1 && race.phase === 'running'); i++) {
        race.advance(1 / 60);
      }
      await nextTick();
      expect(w.get('.leaderboard__title').text()).toBe('Round 2');

      await w.get('.completed__row').trigger('click');
      expect(race.inspectedRound).toBe(0);
      expect(w.get('.leaderboard__title').text()).toBe('Round 1');
      expect(w.get('.completed__row').attributes('aria-pressed')).toBe('true');

      await w.get('.leaderboard__back').trigger('click');
      expect(race.inspectedRound).toBeNull();
      expect(w.get('.leaderboard__title').text()).toBe('Round 2');
      expect(w.find('.leaderboard__back').exists()).toBe(false);

      const firstRow = w.findAll('.leaderboard__button')[0]!;
      await firstRow.trigger('click');
      expect(prefs.followedHorseId).toBe(race.program!.rounds[1]!.lineup[0]);
      expect(firstRow.attributes('aria-pressed')).toBe('true');
    });
  });

  describe('dismissing the follow by clicking outside', () => {
    it('clears on a non-interactive area, keeps it on controls and while a dialog is open', async () => {
      const { wrapper: w, prefs, race } = mountApp();
      prefs.toggleFollow(3);
      await w.find('.panel-card__title').trigger('click');
      expect(prefs.followedHorseId).toBeNull();

      prefs.toggleFollow(3);
      await w.findAll('.speed-selector__option')[2]!.trigger('click');
      expect(prefs.followedHorseId).toBe(3);
      await w.findAll('.stable-table__row')[5]!.trigger('click');
      expect(prefs.followedHorseId).toBe(6);

      race.generateProgram();
      race.togglePlayback();
      for (let i = 0; i < 400; i++) race.advance(1 / 60);
      race.requestNewProgram();
      await nextTick();
      document.body.click();
      expect(prefs.followedHorseId).toBe(6);
    });
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
