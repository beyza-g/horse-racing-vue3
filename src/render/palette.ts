/** Canvas colours per theme. Keep in sync with src/styles/tokens.css. */
export type Theme = 'dark' | 'light';

export interface TrackPalette {
  readonly turf: string;
  readonly stripe: string;
  readonly topShade: string;
  readonly bottomShade: string;
  readonly flood: string;
  readonly band: string;
  readonly apron: string;
  readonly laneAlt: string;
  readonly laneLine: string;
  readonly rail: string;
  readonly railPost: string;
  readonly pole: string;
  readonly poleText: string;
  readonly text: string;
  readonly muted: string;
  readonly tag: string;
  readonly tagShadow: string | null;
  readonly accent: string;
  readonly accentText: string;
  readonly vignette: string;
  readonly chip: string;
  readonly chipText: string;
  readonly startLine: string;
  readonly dust: readonly [string, string];
  readonly followLane: string;
  /** Pointer hover on a lane: a neutral wash, never the accent used for following. */
  readonly hoverLane: string;
  readonly hoverLaneEdge: string;
  readonly followGuide: string;
  readonly dimAlpha: number;
  readonly scrim: string;
  readonly card: string;
  readonly cardLine: string;
  readonly gate: string;
  readonly gateLine: string;
  readonly pausedText: string;
  readonly spotlight: number;
  readonly turfGrain: readonly [string, string];
}

export const PALETTES: Readonly<Record<Theme, TrackPalette>> = Object.freeze({
  dark: {
    turf: '#1b3a25',
    stripe: 'rgba(255,255,255,0.03)',
    topShade: 'rgba(4,10,6,0.45)',
    bottomShade: 'rgba(4,10,6,0.3)',
    flood: 'rgba(255,246,220,0.13)',
    band: 'rgba(9,13,11,0.8)',
    apron: 'rgba(0,0,0,0.28)',
    laneAlt: 'rgba(0,0,0,0.07)',
    laneLine: 'rgba(236,234,227,0.13)',
    rail: 'rgba(240,238,230,0.85)',
    railPost: 'rgba(240,238,230,0.3)',
    pole: 'rgba(236,234,227,0.06)',
    poleText: 'rgba(236,234,227,0.55)',
    text: '#ECEAE3',
    muted: 'rgba(236,234,227,0.65)',
    tag: 'rgba(236,234,227,0.92)',
    tagShadow: null,
    accent: '#F2B544',
    accentText: '#F2B544',
    vignette: 'rgba(0,0,0,0.35)',
    chip: 'rgba(12,16,14,0.8)',
    chipText: '#ECEAE3',
    startLine: 'rgba(236,234,227,0.4)',
    dust: ['#2f5a37', '#6a5838'],
    followLane: 'rgba(242,181,68,0.12)',
    hoverLane: 'rgba(236,234,227,0.06)',
    hoverLaneEdge: 'rgba(236,234,227,0.22)',
    followGuide: 'rgba(236,234,227,0.3)',
    dimAlpha: 0.3,
    scrim: 'rgba(6,10,8,0.55)',
    card: 'rgba(16,21,18,0.94)',
    cardLine: 'rgba(236,234,227,0.14)',
    gate: 'rgba(10,13,11,0.88)',
    gateLine: 'rgba(236,234,227,0.35)',
    pausedText: '#121714',
    spotlight: 0.24,
    turfGrain: ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.12)'],
  },
  light: {
    turf: '#477f44',
    stripe: 'rgba(255,255,255,0.07)',
    topShade: 'rgba(10,40,10,0.12)',
    bottomShade: 'rgba(10,40,10,0.12)',
    flood: 'rgba(255,252,235,0.16)',
    band: '#FAF9F6',
    apron: 'rgba(60,45,25,0.18)',
    laneAlt: 'rgba(0,0,0,0.04)',
    laneLine: 'rgba(255,255,255,0.34)',
    rail: '#ffffff',
    railPost: 'rgba(255,255,255,0.75)',
    pole: 'rgba(255,255,255,0.18)',
    poleText: 'rgba(15,19,16,0.7)',
    text: '#0F1310',
    muted: 'rgba(15,19,16,0.66)',
    tag: '#FFFFFF',
    tagShadow: 'rgba(0,0,0,0.45)',
    accent: '#E2A136',
    accentText: '#7A4C05',
    vignette: 'rgba(0,0,0,0.1)',
    chip: 'rgba(255,255,255,0.95)',
    chipText: '#0F1310',
    startLine: 'rgba(255,255,255,0.8)',
    dust: ['#3a7337', '#86704a'],
    followLane: 'rgba(255,240,200,0.28)',
    hoverLane: 'rgba(255,255,255,0.14)',
    hoverLaneEdge: 'rgba(255,255,255,0.55)',
    followGuide: 'rgba(255,255,255,0.55)',
    dimAlpha: 0.42,
    scrim: 'rgba(250,249,246,0.5)',
    card: 'rgba(255,255,255,0.97)',
    cardLine: 'rgba(15,19,16,0.14)',
    gate: 'rgba(250,249,246,0.95)',
    gateLine: 'rgba(15,19,16,0.25)',
    pausedText: '#FFFFFF',
    spotlight: 0.14,
    turfGrain: ['rgba(255,255,255,0.09)', 'rgba(0,40,0,0.08)'],
  },
});

/** Shared colours that do not change with the theme. */
export const TRACK_COLORS = Object.freeze({
  silver: '#D5D9DC',
  bronze: '#D69C6A',
  medalInk: '#14110A',
  finishRed: '#C8423A',
  finishLight: '#f1efe8',
  finishDark: '#0d0f0e',
  flagCenter: '#F4F2EC',
  /** RGB of the accent glow used for the finish flash and winner sweep. */
  glowRgb: '242,181,68',
});

export const FONT_SANS = '"Archivo Variable", Archivo, system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Darkens (factor < 1) or lightens a `#rrggbb` colour. Returns an `rgb()` string. */
export function shadeHex(hex: string, factor: number): string {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * factor)));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}
