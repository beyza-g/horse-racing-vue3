import { describe, expect, it } from 'vitest';
import { resolveShortcut, toKeyInput, type KeyInput } from './shortcuts';

const key = (patch: Partial<KeyInput>): KeyInput => ({
  key: '',
  code: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  targetTag: 'BODY',
  targetEditable: false,
  ...patch,
});
const space = key({ key: ' ', code: 'Space' });
const closed = { dialog: null };
const open = { dialog: 'completion' } as const;
const confirming = { dialog: 'confirm-regenerate' } as const;

describe('resolveShortcut', () => {
  it('maps the documented keys', () => {
    expect(resolveShortcut(space, closed)).toEqual({ type: 'togglePlayback' });
    expect(resolveShortcut(key({ key: 'f' }), closed)).toEqual({ type: 'toggleFocus' });
    expect(resolveShortcut(key({ key: 'F' }), closed)).toEqual({ type: 'toggleFocus' });
    expect(resolveShortcut(key({ key: 'T' }), closed)).toEqual({ type: 'toggleTheme' });
    expect(resolveShortcut(key({ key: 'Escape' }), closed)).toEqual({ type: 'escape' });
    for (const speed of [1, 2, 4] as const) {
      expect(resolveShortcut(key({ key: String(speed) }), closed)).toEqual({
        type: 'setSpeed',
        speed,
      });
    }
  });

  it('ignores unsupported speeds and other keys', () => {
    for (const k of ['3', '0', '9', 'a', 'Enter', 'Tab'])
      expect(resolveShortcut(key({ key: k }), closed)).toBeNull();
  });

  it('leaves Space to a focused button', () => {
    expect(resolveShortcut({ ...space, targetTag: 'BUTTON' }, closed)).toBeNull();
  });

  it('never intercepts typing in fields or modifier combinations', () => {
    expect(
      resolveShortcut({ ...space, targetEditable: true, targetTag: 'INPUT' }, closed),
    ).toBeNull();
    expect(resolveShortcut(key({ key: 't', targetEditable: true }), closed)).toBeNull();
    expect(resolveShortcut(key({ key: 't', metaKey: true }), closed)).toBeNull();
    expect(resolveShortcut(key({ key: 'f', ctrlKey: true }), closed)).toBeNull();
    expect(resolveShortcut(key({ key: '2', altKey: true }), closed)).toBeNull();
  });

  it('gives the open dialog precedence: only Enter and Escape act, Space is swallowed', () => {
    expect(resolveShortcut(key({ key: 'Escape' }), open)).toEqual({ type: 'dismissDialog' });
    expect(resolveShortcut(key({ key: 'Enter' }), open)).toEqual({ type: 'confirmDialog' });
    expect(resolveShortcut(space, open)).toEqual({ type: 'block' });
    for (const k of ['f', 't', '4']) expect(resolveShortcut(key({ key: k }), open)).toBeNull();
  });

  it('never lets Enter confirm the destructive regenerate dialog', () => {
    expect(resolveShortcut(key({ key: 'Enter' }), confirming)).toEqual({ type: 'block' });
    expect(resolveShortcut(key({ key: 'Escape' }), confirming)).toEqual({ type: 'dismissDialog' });
    expect(resolveShortcut(space, confirming)).toEqual({ type: 'block' });
    expect(resolveShortcut(key({ key: 'Enter', targetTag: 'BUTTON' }), confirming)).toBeNull();
    for (const k of ['f', 't', '4'])
      expect(resolveShortcut(key({ key: k }), confirming)).toBeNull();
  });

  it('lets a focused dialog button handle Enter and Space natively', () => {
    expect(resolveShortcut(key({ key: 'Enter', targetTag: 'BUTTON' }), open)).toBeNull();
    expect(resolveShortcut({ ...space, targetTag: 'BUTTON' }, open)).toBeNull();
  });
});

describe('toKeyInput', () => {
  it('reads the target element', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const event = new KeyboardEvent('keydown', { key: 'f', code: 'KeyF' });
    Object.defineProperty(event, 'target', { value: input });
    expect(toKeyInput(event)).toMatchObject({ key: 'f', targetTag: 'INPUT', targetEditable: true });
    input.remove();
  });

  it('handles a non-element target', () => {
    expect(toKeyInput(new KeyboardEvent('keydown', { key: 'x' })).targetTag).toBe('');
  });
});
