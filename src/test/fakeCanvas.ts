/**
 * A recording stand-in for CanvasRenderingContext2D. Every method is a no-op
 * that records its name; gradients and patterns are inert objects. Lets
 * render code run (and be asserted on) without a real canvas backend.
 */
export interface FakeContext {
  readonly context: CanvasRenderingContext2D;
  readonly calls: string[];
  readonly texts: string[];
}

export function createFakeContext(): FakeContext {
  const calls: string[] = [];
  const texts: string[] = [];
  const state: Record<string, unknown> = {};
  const gradient = { addColorStop: () => undefined };
  const target = {
    measureText: (text: string) => ({ width: text.length * 6 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    fillText: (text: string) => {
      texts.push(text);
    },
  };
  const context = new Proxy(target, {
    get(object, key: string) {
      if (key in object) {
        calls.push(key);
        return object[key as keyof typeof object];
      }
      if (key in state) return state[key];
      return () => {
        calls.push(key);
      };
    },
    set(_object, key: string, value: unknown) {
      state[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { context, calls, texts };
}
