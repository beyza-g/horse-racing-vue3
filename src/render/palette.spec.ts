import { describe, expect, it } from 'vitest';
import { PALETTES, shadeHex } from './palette';

describe('palettes', () => {
  it('define the same keys for both themes', () => {
    expect(Object.keys(PALETTES.light).sort()).toEqual(Object.keys(PALETTES.dark).sort());
  });
});

describe('shadeHex', () => {
  it('scales and clamps each channel', () => {
    expect(shadeHex('#808080', 0.5)).toBe('rgb(64,64,64)');
    expect(shadeHex('#ff0000', 2)).toBe('rgb(255,0,0)');
    expect(shadeHex('3b2418', 1)).toBe('rgb(59,36,24)');
  });
});
