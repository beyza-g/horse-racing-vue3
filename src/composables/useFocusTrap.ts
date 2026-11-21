import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface FocusTrapOptions {
  /** Element to focus first; defaults to the first focusable element. */
  readonly initialFocus?: Readonly<Ref<HTMLElement | null>>;
  /** Elements made `inert` while the trap is active (the page behind a dialog). */
  readonly inertTargets?: () => readonly Element[];
}

/** Focusable descendants of `container`, in tab order. */
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.hasAttribute('inert'),
  );
}

/**
 * Keeps keyboard focus inside `container` while `active` is true: moves focus
 * in on activation, wraps Tab / Shift+Tab, makes the background inert and
 * restores the previously focused element afterwards.
 */
export function useFocusTrap(
  container: Ref<HTMLElement | null>,
  active: Ref<boolean>,
  options: FocusTrapOptions = {},
): void {
  let previous: HTMLElement | null = null;
  let inerted: Element[] = [];

  const onKeyDown = (event: KeyboardEvent): void => {
    const root = container.value;
    if (event.key !== 'Tab' || root === null) return;
    const items = focusableWithin(root);
    const first = items[0];
    const last = items[items.length - 1];
    if (first === undefined || last === undefined) {
      event.preventDefault();
      return;
    }
    const current = document.activeElement;
    if (event.shiftKey && (current === first || !root.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !root.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  };

  const activate = async (): Promise<void> => {
    previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inerted = [...(options.inertTargets?.() ?? [])].filter((el) => !el.hasAttribute('inert'));
    for (const element of inerted) element.setAttribute('inert', '');
    document.addEventListener('keydown', onKeyDown, true);
    await nextTick();
    const root = container.value;
    if (root === null) return;
    const target = options.initialFocus?.value ?? focusableWithin(root)[0] ?? root;
    target.focus();
  };

  const deactivate = (): void => {
    document.removeEventListener('keydown', onKeyDown, true);
    for (const element of inerted) element.removeAttribute('inert');
    inerted = [];
    if (previous?.isConnected) previous.focus();
    previous = null;
  };

  watch(
    active,
    (isActive) => {
      if (isActive) void activate();
      else deactivate();
    },
    { immediate: true },
  );
  onBeforeUnmount(deactivate);
}
