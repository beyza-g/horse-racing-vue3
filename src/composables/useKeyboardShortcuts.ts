import { onBeforeUnmount, onMounted } from 'vue';
import {
  resolveShortcut,
  toKeyInput,
  type ShortcutAction,
  type ShortcutContext,
} from './shortcuts';

/**
 * Listens for global shortcuts and hands resolved actions to `dispatch`.
 * `context` is read on every key press, so it can be reactive.
 */
export function useKeyboardShortcuts(
  context: () => ShortcutContext,
  dispatch: (action: ShortcutAction) => void,
): void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.repeat) return;
    const action = resolveShortcut(toKeyInput(event), context());
    if (action === null) return;
    event.preventDefault();
    if (action.type !== 'block') dispatch(action);
  };
  onMounted(() => {
    window.addEventListener('keydown', onKeyDown);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown);
  });
}
