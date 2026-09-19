import { describe, expect, it, vi } from "vitest";
import { GestureEventEmitter } from "./GestureEventEmitter";

describe("GestureEventEmitter", () => {
  it("preserves the shared gesture command contract", () => {
    const callback = vi.fn();
    const emitter = new GestureEventEmitter();
    emitter.subscribe(callback);
    emitter.emitNext(0.91);
    emitter.emitSelect(0.82);
    emitter.emitNeutral();
    expect(callback.mock.calls.map(([event]) => event)).toEqual([
      { command: "NEXT", confidence: 0.91 },
      { command: "SELECT", confidence: 0.82 },
      { command: "NEUTRAL", confidence: 1 },
    ]);
  });
});
