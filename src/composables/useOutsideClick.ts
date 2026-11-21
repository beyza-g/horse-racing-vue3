import { onBeforeUnmount, onMounted } from 'vue';

/**
 * Elements whose clicks are intentional interactions and must never clear a
 * selection: native controls, ARIA widgets, dialogs, the track canvas (which
 * handles its own clicks), and anything marked `data-keep-selection`.
 */
export const KEEPS_SELECTION =
  'button, a[href], input, select, textarea, label, summary, [role="button"], [role="switch"], [role="dialog"], canvas, [data-keep-selection]';

/** Whether a click on `target` is a click on "nothing in particular". Pure, so it is unit-tested. */
export function isDismissClick(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(KEEPS_SELECTION) === null;
}

/**
 * Calls `onDismiss` when the user clicks a non-interactive part of the page
 * while `enabled()` is true. A click that ends a text selection is ignored.
 */
export function useOutsideClick(enabled: () => boolean, onDismiss: () => void): void {
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || !enabled()) return;
    if ((window.getSelection()?.toString() ?? '') !== '') return;
    if (isDismissClick(event.target)) onDismiss();
  };
  onMounted(() => {
    window.addEventListener('click', onClick);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('click', onClick);
  });
}
