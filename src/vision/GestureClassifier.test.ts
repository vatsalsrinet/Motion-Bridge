import { describe, expect, it, vi } from "vitest";
import { GestureClassifier } from "./GestureClassifier";

describe("GestureClassifier", () => {
  it("calculates distance and bounded confidence", () => {
    const classifier = new GestureClassifier({ confidenceDistanceScale: 2 });
    expect(classifier.calculateDistance([0, 0], [3, 4])).toBe(5);
    expect(classifier.calculateConfidence(0)).toBe(1);
    expect(classifier.calculateConfidence(5)).toBeCloseTo(Math.exp(-2.5));
  });

  it("requires stability, emits once, and re-arms after neutral", () => {
    const onGesture = vi.fn();
    const onNeutral = vi.fn();
    const classifier = new GestureClassifier({
      stableDurationMs: 250,
      cooldownMs: 500,
      onGesture,
      onNeutral,
    });
    classifier.setPrototypes({ neutral: [0, 0], next: [3, 0], select: [0, 3] });
    expect(classifier.update([3, 0], 0).label).toBe("NEXT");
    classifier.update([3, 0], 249);
    classifier.update([3, 0], 250);
    expect(onGesture).toHaveBeenCalledTimes(1);
    classifier.update([3, 0], 1000);
    expect(onGesture).toHaveBeenCalledTimes(1);
    classifier.update([0, 0], 1000);
    expect(onNeutral).toHaveBeenCalledTimes(1);
    classifier.update([3, 0], 1001);
    classifier.update([3, 0], 1251);
    expect(onGesture).toHaveBeenCalledTimes(2);
  });

  it("labels distant features unknown", () => {
    const classifier = new GestureClassifier({ unknownDistance: 2 });
    classifier.setPrototypes({ neutral: [0, 0], next: [1, 0], select: [0, 1] });
    expect(classifier.classify([10, 10]).label).toBe("UNKNOWN");
  });

  it("exposes relative class scores and rejects a close tie", () => {
    const classifier = new GestureClassifier({ confidenceDistanceScale: 6 });
    classifier.setPrototypes({ neutral: [0, 0], next: [4, 0], select: [0, 4] });
    const next = classifier.classify([4, 0]);
    expect(next.label).toBe("NEXT");
    expect(next.confidence).toBeGreaterThan(0.8);
    expect(next.classScores?.NEXT).toBeGreaterThan(next.classScores?.SELECT ?? 0);
    expect(next.classScores?.NEXT).toBeGreaterThan(next.classScores?.NEUTRAL ?? 0);
    expect(classifier.classify([2, 2]).label).toBe("UNKNOWN");
  });
});
