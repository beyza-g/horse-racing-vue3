import { isPlaybackSpeed, type PlaybackSpeed } from '@/playback';

/** What a key press should do. */
export type ShortcutAction =
  | { readonly type: 'togglePlayback' }
  | { readonly type: 'toggleFocus' }
  | { readonly type: 'toggleTheme' }
  | { readonly type: 'setSpeed'; readonly speed: PlaybackSpeed }
  | { readonly type: 'escape' }
  | { readonly type: 'confirmDialog' }
  | { readonly type: 'dismissDialog' }
  /** Swallow the key (prevent default) without doing anything. */
  | { readonly type: 'block' };

export interface KeyInput {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  /** Upper-case tag name of the focused element, e.g. "BUTTON". */
  readonly targetTag: string;
  readonly targetEditable: boolean;
}

export interface ShortcutContext {
  /** The blocking completion dialog is open: only its own keys work. */
  readonly dialogOpen: boolean;
}

/**
 * Maps a key press to an action. Pure, so every rule is unit-tested:
 * - modifier combinations and typing in fields are never intercepted;
 * - while the dialog is open only Enter (confirm) and Escape (dismiss) work;
 * - Space on a focused button is left to the button (native activation).
 */
export function resolveShortcut(input: KeyInput, context: ShortcutContext): ShortcutAction | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  const space = input.code === 'Space' || input.key === ' ';
  const onButton = input.targetTag === 'BUTTON';

  if (context.dialogOpen) {
    if (input.key === 'Escape') return { type: 'dismissDialog' };
    if (input.key === 'Enter' && !onButton) return { type: 'confirmDialog' };
    if (space && !onButton) return { type: 'block' };
    return null;
  }
  if (input.targetEditable) return null;
  if (space) return onButton ? null : { type: 'togglePlayback' };
  const key = input.key.toLowerCase();
  if (key === 'f') return { type: 'toggleFocus' };
  if (key === 't') return { type: 'toggleTheme' };
  if (key === 'escape') return { type: 'escape' };
  const speed = Number(input.key);
  if (/^\d$/.test(input.key) && isPlaybackSpeed(speed)) return { type: 'setSpeed', speed };
  return null;
}

/** Builds a {@link KeyInput} from a DOM keyboard event. */
export function toKeyInput(event: KeyboardEvent): KeyInput {
  const target = event.target instanceof HTMLElement ? event.target : null;
  return {
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    targetTag: target?.tagName ?? '',
    targetEditable:
      target !== null &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)),
  };
}
