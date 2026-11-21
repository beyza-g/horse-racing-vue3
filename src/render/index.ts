/** Public API of the render layer: Canvas drawing only, no Vue or Pinia. */
export { computeGeometry, laneAtY, noseX, type TrackGeometry } from './geometry';
export { PALETTES, type Theme } from './palette';
export { createTrackRenderer, type TrackRenderer, type TrackScene } from './renderer';
