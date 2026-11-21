// Shared setup for the jsdom ("ui") Vitest project.
import { afterEach, vi } from 'vitest';

// jsdom has no canvas backend; returning null makes canvas code take its no-context path quietly.
HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  try {
    localStorage.clear();
  } catch {
    // Storage may be deliberately broken by a test.
  }
});
