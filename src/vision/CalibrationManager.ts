import {
  DEFAULT_GESTURE_REQUIRED,
  DEFAULT_NEUTRAL_REQUIRED,
  MotionBridgeError,
  type CalibrationProgress,
  type GestureType,
} from "./types";

export type CalibrationManagerOptions = {
  neutralRequired?: number;
  gestureRequired?: number;
  minimumPrototypeDistance?: number;
};

/** Collects personalized examples and exposes normalized centroid prototypes. */
export class CalibrationManager {
  private neutralSamples: number[][] = [];
  private nextSamples: number[][] = [];
  private selectSamples: number[][] = [];
  private neutralVector: number[] = [];
  private neutralScale: number[] = [];

  readonly neutralRequired: number;
  readonly gestureRequired: number;
  readonly minimumPrototypeDistance: number;

  constructor(options: CalibrationManagerOptions = {}) {
    this.neutralRequired = options.neutralRequired ?? DEFAULT_NEUTRAL_REQUIRED;
    this.gestureRequired = options.gestureRequired ?? DEFAULT_GESTURE_REQUIRED;
    this.minimumPrototypeDistance = options.minimumPrototypeDistance ?? 0.12;
  }

  captureNeutral(features: number[]): void {
    this.addSample(this.neutralSamples, features, this.neutralRequired);
    this.neutralVector = averageVectors(this.neutralSamples);
    this.neutralScale = calculateScales(this.neutralSamples, this.neutralVector);
  }

  captureGesture(type: GestureType, features: number[]): void {
    if (!this.neutralVector.length) {
      throw new MotionBridgeError(
        "INVALID_FEATURES",
        "Capture neutral samples before teaching a gesture.",
      );
    }
    const samples = type === "NEXT" ? this.nextSamples : this.selectSamples;
    this.addSample(samples, features, this.gestureRequired);
  }

  calculateNeutralVector(): number[] {
    return [...this.neutralVector];
  }

  calculateGesturePrototype(type: GestureType): number[] {
    const samples = type === "NEXT" ? this.nextSamples : this.selectSamples;
    if (!samples.length) return [];
    return averageVectors(samples).map((value, index) => this.normalizeValue(value, index));
  }

  normalizeFeatures(features: number[]): number[] {
    this.validateVector(features);
    if (!this.neutralVector.length) return [...features];
    if (features.length !== this.neutralVector.length) {
      throw new MotionBridgeError("INVALID_FEATURES", "Feature vector length changed during calibration.");
    }
    return features.map((value, index) => this.normalizeValue(value, index));
  }

  getProgress(): CalibrationProgress {
    return {
      neutral: this.neutralSamples.length,
      next: this.nextSamples.length,
      select: this.selectSamples.length,
      neutralRequired: this.neutralRequired,
      gestureRequired: this.gestureRequired,
    };
  }

  getPrototype(type: GestureType | "NEUTRAL"): number[] {
    if (type === "NEUTRAL") {
      return this.neutralVector.length ? this.neutralVector.map((value, index) => this.normalizeValue(value, index)) : [];
    }
    return this.calculateGesturePrototype(type);
  }

  isCalibrationComplete(): boolean {
    if (
      this.neutralSamples.length < this.neutralRequired ||
      this.nextSamples.length < this.gestureRequired ||
      this.selectSamples.length < this.gestureRequired
    ) {
      return false;
    }
    const next = this.calculateGesturePrototype("NEXT");
    const select = this.calculateGesturePrototype("SELECT");
    return euclideanDistance(next, select) >= this.minimumPrototypeDistance;
  }

  resetCalibration(): void {
    this.neutralSamples = [];
    this.nextSamples = [];
    this.selectSamples = [];
    this.neutralVector = [];
    this.neutralScale = [];
  }

  private addSample(target: number[][], features: number[], limit: number): void {
    this.validateVector(features);
    if (target.length >= limit) return;
    if (this.neutralVector.length && features.length !== this.neutralVector.length) {
      throw new MotionBridgeError("INVALID_FEATURES", "Feature vector length changed during calibration.");
    }
    target.push([...features]);
  }

  private validateVector(features: number[]): void {
    if (!features.length || !features.every(Number.isFinite)) {
      throw new MotionBridgeError("INVALID_FEATURES", "Feature vectors must contain finite values.");
    }
  }

  private normalizeValue(value: number, index: number): number {
    return (value - (this.neutralVector[index] ?? 0)) / (this.neutralScale[index] ?? 1);
  }
}

export function averageVectors(vectors: readonly number[][]): number[] {
  if (!vectors.length) return [];
  const length = vectors[0].length;
  const totals = Array.from({ length }, () => 0);
  for (const vector of vectors) {
    if (vector.length !== length) throw new Error("Cannot average vectors with different lengths.");
    vector.forEach((value, index) => {
      totals[index] += value;
    });
  }
  return totals.map((value) => value / vectors.length);
}

export function euclideanDistance(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  return Math.sqrt(a.reduce((total, value, index) => total + (value - b[index]) ** 2, 0));
}

function calculateScales(samples: readonly number[][], centroid: readonly number[]): number[] {
  if (!samples.length) return [];
  return centroid.map((_, index) => {
    const variance = samples.reduce((total, sample) => total + (sample[index] - centroid[index]) ** 2, 0) / samples.length;
    return Math.max(Math.sqrt(variance), 0.05);
  });
}
