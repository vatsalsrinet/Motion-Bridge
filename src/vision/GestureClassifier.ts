import { euclideanDistance } from "./CalibrationManager";
import type { GestureLabel, GesturePrediction, GestureType } from "./types";

export type GestureClassifierOptions = {
  confidenceThreshold?: number;
  neutralConfidenceThreshold?: number;
  unknownDistance?: number;
  confidenceDistanceScale?: number;
  stableDurationMs?: number;
  cooldownMs?: number;
  neutralDistance?: number;
  onGesture?: (prediction: GesturePrediction) => void;
  onNeutral?: () => void;
};

export type GesturePrototypes = {
  neutral: number[];
  next: number[];
  select: number[];
};

/** Nearest-centroid classifier with stability, cooldown, and neutral re-arming. */
export class GestureClassifier {
  readonly confidenceThreshold: number;
  readonly neutralConfidenceThreshold: number;
  readonly unknownDistance: number;
  readonly confidenceDistanceScale: number;
  readonly stableDurationMs: number;
  readonly cooldownMs: number;
  readonly neutralDistance: number;

  private prototypes: GesturePrototypes = { neutral: [], next: [], select: [] };
  private lastTriggerTime = Number.NEGATIVE_INFINITY;
  private waitingForNeutral = false;
  private candidate?: GestureType;
  private candidateSince = 0;

  constructor(options: GestureClassifierOptions = {}) {
    this.confidenceThreshold = options.confidenceThreshold ?? 0.65;
    this.neutralConfidenceThreshold = options.neutralConfidenceThreshold ?? 0.55;
    this.unknownDistance = options.unknownDistance ?? 7;
    this.confidenceDistanceScale = options.confidenceDistanceScale ?? 3;
    this.stableDurationMs = options.stableDurationMs ?? 250;
    this.cooldownMs = options.cooldownMs ?? 700;
    this.neutralDistance = options.neutralDistance ?? 2.25;
    this.onGesture = options.onGesture;
    this.onNeutral = options.onNeutral;
  }

  private readonly onGesture?: (prediction: GesturePrediction) => void;
  private readonly onNeutral?: () => void;

  setPrototypes(prototypes: GesturePrototypes): void {
    this.prototypes = {
      neutral: [...prototypes.neutral],
      next: [...prototypes.next],
      select: [...prototypes.select],
    };
    this.resetTriggerState();
  }

  classify(features: number[]): GesturePrediction {
    if (!features.length || !features.every(Number.isFinite) || !this.hasPrototypes()) {
      return { label: "UNKNOWN", confidence: 0 };
    }

    const candidates: Array<{ label: GestureLabel; distance: number }> = [
      { label: "NEUTRAL", distance: this.calculateDistance(features, this.prototypes.neutral) },
      { label: "NEXT", distance: this.calculateDistance(features, this.prototypes.next) },
      { label: "SELECT", distance: this.calculateDistance(features, this.prototypes.select) },
    ].sort((a, b) => a.distance - b.distance);
    const closest = candidates[0];
    const confidence = this.calculateConfidence(closest.distance);
    const isNeutral = closest.label === "NEUTRAL" && closest.distance <= this.neutralDistance;
    if (isNeutral && confidence >= this.neutralConfidenceThreshold) {
      return { label: "NEUTRAL", confidence, distance: closest.distance };
    }
    if (closest.label !== "NEUTRAL" && closest.distance <= this.unknownDistance && confidence >= this.confidenceThreshold) {
      return { label: closest.label as GestureLabel, confidence, distance: closest.distance };
    }
    return { label: "UNKNOWN", confidence, distance: closest.distance };
  }

  calculateDistance(a: number[], b: number[]): number {
    return euclideanDistance(a, b);
  }

  calculateConfidence(distance: number): number {
    if (!Number.isFinite(distance) || distance < 0) return 0;
    return Math.max(0, Math.min(1, Math.exp(-distance / this.confidenceDistanceScale)));
  }

  canTrigger(now = nowMs()): boolean {
    return !this.waitingForNeutral && now - this.lastTriggerTime >= this.cooldownMs;
  }

  hasReturnedToNeutral(features: number[]): boolean {
    if (!this.prototypes.neutral.length) return false;
    return this.calculateDistance(features, this.prototypes.neutral) <= this.neutralDistance;
  }

  /** Feed one normalized frame. Returns its prediction; callbacks fire only on state transitions. */
  update(features: number[], timestamp = nowMs()): GesturePrediction {
    const prediction = this.classify(features);
    if (this.waitingForNeutral) {
      if (prediction.label === "NEUTRAL" && timestamp - this.lastTriggerTime >= this.cooldownMs) {
        this.waitingForNeutral = false;
        this.candidate = undefined;
        this.onNeutral?.();
      }
      return prediction;
    }

    if (prediction.label !== "NEXT" && prediction.label !== "SELECT" || prediction.confidence < this.confidenceThreshold) {
      this.candidate = undefined;
      return prediction;
    }
    if (this.candidate !== prediction.label) {
      this.candidate = prediction.label;
      this.candidateSince = timestamp;
      return prediction;
    }
    if (timestamp - this.candidateSince >= this.stableDurationMs && this.canTrigger(timestamp)) {
      this.triggerGesture(prediction, timestamp);
    }
    return prediction;
  }

  triggerGesture(prediction: GesturePrediction, timestamp = nowMs()): boolean {
    if (
      (prediction.label !== "NEXT" && prediction.label !== "SELECT") ||
      prediction.confidence < this.confidenceThreshold ||
      !this.canTrigger(timestamp)
    ) {
      return false;
    }
    this.lastTriggerTime = timestamp;
    this.waitingForNeutral = true;
    this.candidate = undefined;
    this.onGesture?.(prediction);
    return true;
  }

  resetTriggerState(): void {
    this.lastTriggerTime = Number.NEGATIVE_INFINITY;
    this.waitingForNeutral = false;
    this.candidate = undefined;
    this.candidateSince = 0;
  }

  isWaitingForNeutral(): boolean {
    return this.waitingForNeutral;
  }

  private hasPrototypes(): boolean {
    return this.prototypes.neutral.length > 0 && this.prototypes.next.length > 0 && this.prototypes.select.length > 0;
  }
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
