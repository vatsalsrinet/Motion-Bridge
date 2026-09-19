import type { GestureCommand } from "./types";

export type GestureEventCallback = (event: GestureCommand) => void;

/** Small, UI-agnostic event bus for MotionBridge commands. */
export class GestureEventEmitter {
  private readonly callbacks = new Set<GestureEventCallback>();

  emitNext(confidence: number): void {
    this.emit({ command: "NEXT", confidence: clampConfidence(confidence) });
  }

  emitSelect(confidence: number): void {
    this.emit({ command: "SELECT", confidence: clampConfidence(confidence) });
  }

  emitNeutral(): void {
    this.emit({ command: "NEUTRAL", confidence: 1 });
  }

  subscribe(callback: GestureEventCallback): void {
    this.callbacks.add(callback);
  }

  unsubscribe(callback: GestureEventCallback): void {
    this.callbacks.delete(callback);
  }

  clear(): void {
    this.callbacks.clear();
  }

  private emit(event: GestureCommand): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        // One consumer must not prevent other subscribers from receiving commands.
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }
}

function clampConfidence(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
