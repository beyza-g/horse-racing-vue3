import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { useAnimationFrame, type AnimationFrameOptions } from './useAnimationFrame';

/** A manual requestAnimationFrame: frames run only when the test steps them. */
function fakeFrames() {
  let nextId = 1;
  let queue = new Map<number, FrameRequestCallback>();
  let time = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id);
  });
  return {
    pending: () => queue.size,
    /** Runs every queued frame `ms` after the previous one. */
    step(ms = 16) {
      time += ms;
      const due = queue;
      queue = new Map();
      for (const cb of due.values()) cb(time);
    },
  };
}

function mountLoop(callback: (dt: number) => void, options: AnimationFrameOptions = {}) {
  let controls!: ReturnType<typeof useAnimationFrame>;
  const wrapper = mount(
    defineComponent({
      setup() {
        controls = useAnimationFrame(callback, options);
        return () => h('div');
      },
    }),
  );
  return { wrapper, controls };
}

describe('useAnimationFrame', () => {
  let frames: ReturnType<typeof fakeFrames>;

  beforeEach(() => {
    frames = fakeFrames();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes 0 on the first frame, then the wall delta in seconds', () => {
    const deltas: number[] = [];
    const { wrapper } = mountLoop((dt) => deltas.push(dt));
    frames.step(16);
    frames.step(20);
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeCloseTo(0.02, 10);
    wrapper.unmount();
  });

  it('keeps running after a throwing frame and reports each failing streak once', () => {
    const onError = vi.fn();
    let calls = 0;
    let failUntil = 3;
    const { wrapper } = mountLoop(
      () => {
        calls++;
        if (calls <= failUntil) throw new Error(`frame ${String(calls)}`);
      },
      { onError },
    );
    frames.step();
    frames.step();
    frames.step();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(new Error('frame 1'));
    frames.step();
    expect(calls).toBe(4);
    expect(frames.pending()).toBe(1);

    failUntil = 5;
    frames.step();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenLastCalledWith(new Error('frame 5'));
    wrapper.unmount();
  });

  it('reports to console.error by default', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { wrapper } = mountLoop(() => {
      throw new Error('boom');
    });
    frames.step();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(frames.pending()).toBe(1);
    spy.mockRestore();
    wrapper.unmount();
  });

  it('stops on unmount and when stop() is called from inside the callback', () => {
    let calls = 0;
    const { wrapper, controls } = mountLoop(() => {
      calls++;
      if (calls === 2) controls.stop();
    });
    frames.step();
    frames.step();
    expect(frames.pending()).toBe(0);
    frames.step();
    expect(calls).toBe(2);

    controls.start();
    expect(frames.pending()).toBe(1);
    wrapper.unmount();
    expect(frames.pending()).toBe(0);
  });

  it('start() is idempotent', () => {
    const { wrapper, controls } = mountLoop(() => undefined);
    controls.start();
    controls.start();
    expect(frames.pending()).toBe(1);
    wrapper.unmount();
  });
});
