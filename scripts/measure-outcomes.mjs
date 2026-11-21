/**
 * Reproduces the outcome statistics quoted in docs/domain.md.
 *
 * Runs `PROGRAMS` seeded programs (seeds 1..N) exactly as the app does
 * (session rng -> forked roster -> forked program -> one race per round) and
 * prints distinct winners per program, win rate per condition band relative
 * to a fair share, and the first-to-last spread per distance. Deterministic:
 * the same N always prints the same numbers.
 *
 * Usage: npm run measure:outcomes [-- <programs>]   (default 300)
 *
 * The domain is TypeScript with extensionless imports, so it is loaded through
 * Vite's SSR module loader (Vite is already a dev dependency) instead of
 * adding a TypeScript runner.
 */
import { createServer } from 'vite';

const PROGRAMS = Number(process.argv[2] ?? 300);
if (!Number.isSafeInteger(PROGRAMS) || PROGRAMS < 1) {
  throw new Error(`Expected a positive integer program count, received ${process.argv[2]}.`);
}

const server = await createServer({
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

try {
  const domain = await server.ssrLoadModule('/src/domain/index.ts');
  const { createRng, forkRng, generateHorses, generateProgram, createRace } = domain;
  const { conditionBand, toTimeboardSeconds, ROUND_DISTANCES, RUNNERS_PER_ROUND } = domain;

  const bands = ['race-fit', 'lean', 'fleshy', 'underweight', 'overweight'];
  const starts = Object.fromEntries(bands.map((band) => [band, 0]));
  const wins = Object.fromEntries(bands.map((band) => [band, 0]));
  const spreads = new Map(ROUND_DISTANCES.map((distance) => [distance, []]));
  const winnerTimes = new Map(ROUND_DISTANCES.map((distance) => [distance, []]));
  const distinctWinners = [];

  for (let seed = 1; seed <= PROGRAMS; seed++) {
    const rng = createRng(seed);
    const horses = generateHorses(forkRng(rng));
    const program = generateProgram(horses, forkRng(rng));
    const byId = new Map(horses.map((horse) => [horse.id, horse]));
    const winners = new Set();
    for (const round of program.rounds) {
      const result = createRace(round, horses).runToCompletion();
      for (const id of round.lineup) starts[conditionBand(byId.get(id).condition)]++;
      const first = result.finishers[0];
      const last = result.finishers[result.finishers.length - 1];
      winners.add(first.horseId);
      wins[conditionBand(byId.get(first.horseId).condition)]++;
      spreads.get(round.distance).push(toTimeboardSeconds(last.time - first.time, round.distance));
      winnerTimes.get(round.distance).push(toTimeboardSeconds(first.time, round.distance));
    }
    distinctWinners.push(winners.size);
  }

  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const fixed = (value, digits = 2) => value.toFixed(digits);
  const lines = [
    `Programs: ${PROGRAMS} (seeds 1-${PROGRAMS})`,
    '',
    `Distinct winners per program: mean ${fixed(mean(distinctWinners))}, min ${Math.min(...distinctWinners)}, max ${Math.max(...distinctWinners)}`,
    '',
    'Win rate relative to a fair share (1.00 = wins once in ten starts):',
    ...bands.map((band) => {
      const ratio = starts[band] === 0 ? 0 : (wins[band] / starts[band]) * RUNNERS_PER_ROUND;
      return `  ${band.padEnd(12)} ${fixed(ratio)}x  (${wins[band]} wins / ${starts[band]} starts)`;
    }),
    '',
    'Per distance (timeboard seconds): mean winning time, mean first-to-last spread',
    ...ROUND_DISTANCES.map(
      (distance) =>
        `  ${String(distance).padStart(4)} m  winner ${fixed(mean(winnerTimes.get(distance)), 1)} s, spread ${fixed(mean(spreads.get(distance)), 1)} s`,
    ),
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
} finally {
  await server.close();
}
