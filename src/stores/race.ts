import { defineStore } from 'pinia';
import { computed, markRaw, ref, shallowRef, watch } from 'vue';
import {
  createRng,
  forkRng,
  generateHorses,
  generateProgram as drawProgram,
  indexRoster,
  type Horse,
  type HorseId,
  type Program,
  type Rng,
  type RoundResult,
} from '@/domain';
import {
  buildLiveOrder,
  createPublishGate,
  createRaceDirector,
  sanitizeFrameDt,
  type DirectorEvent,
  type DirectorPhase,
  type LiveOrderEntry,
  type RaceDirector,
  type RaceDirectorView,
} from '@/playback';
import { usePreferencesStore } from './preferences';
import {
  buildBoard,
  buildCompletedRounds,
  buildCompletionWinners,
  buildPlaybackControl,
  buildProgress,
  buildRounds,
  buildStable,
  buildStandings,
  buildStatus,
  describeDiscardedProgress,
  isGeneratePrimary,
  regenerateNeedsConfirmation,
  type RaceViewState,
} from '@/viewModels';

/** A random 32-bit seed when none is supplied (outside the pure layers, so host randomness is fine). */
function randomSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] ?? 0;
}

/** Parses `?seed=123` from a query string; null when absent or invalid. */
export function parseSeed(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value >>> 0 : null;
}

/**
 * Game state. Owns the (non-reactive) race director and mirrors only what
 * the UI needs into reactive state: phase, results, the throttled live
 * order and the user's inspection choices. Per-frame positions stay in the
 * director and are read by the renderer directly.
 */
export const useRaceStore = defineStore('race', () => {
  const preferences = usePreferencesStore();
  const director: RaceDirector = markRaw(createRaceDirector({ speed: preferences.speed }));
  const liveGate = createPublishGate();
  let rng: Rng = createRng(randomSeed());

  const horses = shallowRef<readonly Horse[]>([]);
  const program = shallowRef<Program | null>(null);
  const results = shallowRef<readonly RoundResult[]>([]);
  const phase = ref<DirectorPhase>('idle');
  const paused = ref(false);
  const roundIndex = ref(-1);
  const liveOrder = shallowRef<readonly LiveOrderEntry[] | null>(null);
  const inspectedRound = ref<number | null>(null);
  const expandedRound = ref<number | null>(null);
  const completionDismissed = ref(false);
  const confirmRegenerateOpen = ref(false);
  const standingsOpen = ref(false);
  /** True when opening the standings paused a running race, so closing resumes it. */
  let resumeAfterStandings = false;
  /** True when opening the confirmation paused a running race, so cancelling resumes it. */
  let resumeAfterCancel = false;

  const horsesById = computed<ReadonlyMap<HorseId, Horse>>(() => indexRoster(horses.value));
  const hasProgram = computed(() => program.value !== null);

  watch(
    () => preferences.speed,
    (speed) => {
      director.setSpeed(speed);
    },
    { flush: 'sync' },
  );

  const syncFromDirector = (): void => {
    phase.value = director.phase;
    paused.value = director.paused;
    roundIndex.value = director.roundIndex;
  };

  /** Creates the session's roster. A seed makes the whole session reproducible (used by E2E tests). */
  function initialize(sessionSeed: number | null = null): void {
    const resolved = sessionSeed ?? randomSeed();
    rng = createRng(resolved);
    horses.value = generateHorses(forkRng(rng));
    program.value = null;
    results.value = [];
    liveOrder.value = null;
    inspectedRound.value = null;
    expandedRound.value = null;
    completionDismissed.value = false;
    liveGate.reset();
    director.clear();
    syncFromDirector();
  }

  /** Draws a new program and resets to round 1 at the gates. Valid at any time, even mid-race. */
  function generateProgram(): void {
    confirmRegenerateOpen.value = false;
    standingsOpen.value = false;
    resumeAfterStandings = false;
    resumeAfterCancel = false;
    if (horses.value.length === 0) initialize();
    const next = drawProgram(horses.value, forkRng(rng));
    program.value = next;
    results.value = [];
    liveOrder.value = null;
    inspectedRound.value = null;
    expandedRound.value = 0;
    completionDismissed.value = false;
    liveGate.reset();
    director.load(horses.value, next);
    syncFromDirector();
  }

  /**
   * The Generate button: generates immediately unless that would discard a
   * race or official results, in which case it pauses (remembering whether it
   * did) and asks for confirmation first.
   */
  function requestNewProgram(): void {
    if (!regenerateNeedsConfirmation(viewState.value)) {
      generateProgram();
      return;
    }
    if (confirmRegenerateOpen.value) return;
    resumeAfterCancel = director.pause();
    syncFromDirector();
    confirmRegenerateOpen.value = true;
  }

  function confirmNewProgram(): void {
    generateProgram();
  }

  /** Keeps the current program; resumes only if the confirmation was what paused it. */
  function cancelNewProgram(): void {
    confirmRegenerateOpen.value = false;
    if (resumeAfterCancel) director.resume();
    resumeAfterCancel = false;
    syncFromDirector();
  }

  /** Start from the gates, or pause / resume. Ignored before a program exists and after completion. */
  function togglePlayback(): void {
    const command = director.togglePlayback();
    if (command === 'started') inspectedRound.value = null;
    syncFromDirector();
  }

  const applyEvent = (event: DirectorEvent): boolean => {
    switch (event.type) {
      case 'phaseChanged':
        phase.value = event.phase;
        if (event.roundIndex !== roundIndex.value) {
          roundIndex.value = event.roundIndex;
          expandedRound.value = event.roundIndex;
          inspectedRound.value = null;
          liveOrder.value = null;
          liveGate.reset();
        }
        return event.phase === 'running';
      case 'roundOfficial':
        results.value = [...results.value, event.result];
        return false;
      case 'runnerFinished':
        return true;
      case 'standingsChanged':
      case 'programComplete':
        return false;
    }
  };

  /** Advances the game by one animation frame. Called by the render loop. */
  function advance(wallDt: number): void {
    const events = director.frame(wallDt);
    let force = false;
    let changed = false;
    for (const event of events) {
      if (applyEvent(event)) force = true;
      if (event.type === 'standingsChanged') changed = true;
    }
    const race = director.race;
    const live = director.phase === 'running' || director.phase === 'settling';
    if (race !== null && live && liveGate.update(sanitizeFrameDt(wallDt), changed, force)) {
      liveOrder.value = buildLiveOrder(race);
    }
  }

  /** Shows a round's full result on the board (null returns to the live round). */
  function inspectRound(index: number | null): void {
    inspectedRound.value = index;
  }

  function toggleRoundExpanded(index: number): void {
    if (program.value === null) return;
    expandedRound.value = expandedRound.value === index ? null : index;
  }

  function dismissCompletion(): void {
    completionDismissed.value = true;
  }

  /**
   * Opens the full standings table. It is a blocking dialog, so a running
   * race pauses rather than playing on unseen; closing resumes it only if
   * opening was what paused it. Opened from the completion summary, the
   * summary steps aside (it is hidden, not dismissed: only "View track"
   * dismisses it), so closing the standings returns to the summary.
   */
  function openStandings(): void {
    if (program.value === null || confirmRegenerateOpen.value || standingsOpen.value) return;
    resumeAfterStandings = director.pause();
    syncFromDirector();
    standingsOpen.value = true;
  }

  function closeStandings(): void {
    standingsOpen.value = false;
    if (resumeAfterStandings) director.resume();
    resumeAfterStandings = false;
    syncFromDirector();
  }

  /**
   * Shared input for the view models. The live order is left out on purpose:
   * it publishes up to four times a second while racing, and only the board
   * reads it. Including it here would rebuild (and re-render) every panel on
   * each publication; instead the board combines the two below.
   */
  const viewState = computed<RaceViewState>(() => ({
    horses: horsesById.value,
    program: program.value,
    results: results.value,
    phase: phase.value,
    paused: paused.value,
    roundIndex: roundIndex.value,
    liveOrder: null,
    inspectedRound: inspectedRound.value,
    expandedRound: expandedRound.value,
    followedHorseId: preferences.followedHorseId,
  }));

  const status = computed(() => buildStatus(viewState.value));
  const progress = computed(() => buildProgress(viewState.value));
  const playbackControl = computed(() => buildPlaybackControl(viewState.value));
  const generatePrimary = computed(() => isGeneratePrimary(viewState.value));
  const board = computed(() => buildBoard({ ...viewState.value, liveOrder: liveOrder.value }));
  const completedRounds = computed(() => buildCompletedRounds(viewState.value));
  const rounds = computed(() => buildRounds(viewState.value));
  const stable = computed(() => buildStable(viewState.value));
  const completionWinners = computed(() => buildCompletionWinners(viewState.value));
  // While standings are open the summary waits, so two modals never stack.
  const completionOpen = computed(
    () => phase.value === 'complete' && !completionDismissed.value && !standingsOpen.value,
  );
  const discardedProgress = computed(() => describeDiscardedProgress(viewState.value));
  const standings = computed(() => buildStandings(viewState.value));
  /** True when closing the standings returns to the completion summary. */
  const standingsReturnToSummary = computed(
    () => phase.value === 'complete' && !completionDismissed.value,
  );

  return {
    horses,
    horsesById,
    program,
    results,
    phase,
    paused,
    roundIndex,
    liveOrder,
    inspectedRound,
    expandedRound,
    completionDismissed,
    hasProgram,
    status,
    progress,
    playbackControl,
    generatePrimary,
    board,
    completedRounds,
    rounds,
    stable,
    completionWinners,
    completionOpen,
    confirmRegenerateOpen,
    discardedProgress,
    standings,
    standingsOpen,
    standingsReturnToSummary,
    initialize,
    generateProgram,
    requestNewProgram,
    confirmNewProgram,
    cancelNewProgram,
    togglePlayback,
    advance,
    inspectRound,
    toggleRoundExpanded,
    dismissCompletion,
    openStandings,
    closeStandings,
    /** Read-only view of the live director, for the renderer; commands go through this store. */
    getDirector: (): RaceDirectorView => director,
  };
});
