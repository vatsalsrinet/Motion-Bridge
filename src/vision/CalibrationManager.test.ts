import { describe, expect, it } from "vitest";
import { CalibrationManager, averageVectors, euclideanDistance } from "./CalibrationManager";

describe("CalibrationManager", () => {
  it("averages vectors and normalizes around neutral", () => {
    expect(averageVectors([[1, 3], [3, 5]])).toEqual([2, 4]);
    const calibration = new CalibrationManager({ neutralRequired: 3, gestureRequired: 2 });
    calibration.captureNeutral([10, 20]);
    calibration.captureNeutral([11, 20]);
    calibration.captureNeutral([9, 20]);
    expect(calibration.calculateNeutralVector()).toEqual([10, 20]);
    expect(calibration.normalizeFeatures([10, 20])).toEqual([0, 0]);
    expect(calibration.normalizeFeatures([11, 20])[0]).toBeGreaterThan(1);
  });

  it("completes only after both gestures have enough distinct examples", () => {
    const calibration = new CalibrationManager({ neutralRequired: 2, gestureRequired: 2, minimumPrototypeDistance: 1 });
    calibration.captureNeutral([0, 0]);
    calibration.captureNeutral([0, 0]);
    calibration.captureGesture("NEXT", [1, 0]);
    calibration.captureGesture("NEXT", [1, 0]);
    calibration.captureGesture("SELECT", [1, 0]);
    calibration.captureGesture("SELECT", [1, 0]);
    expect(calibration.isCalibrationComplete()).toBe(false);
    calibration.resetCalibration();
    calibration.captureNeutral([0, 0]);
    calibration.captureNeutral([0, 0]);
    calibration.captureGesture("NEXT", [1, 0]);
    calibration.captureGesture("NEXT", [1, 0]);
    calibration.captureGesture("SELECT", [-1, 0]);
    calibration.captureGesture("SELECT", [-1, 0]);
    expect(calibration.isCalibrationComplete()).toBe(true);
  });

  it("returns infinity for vectors with incompatible dimensions", () => {
    expect(euclideanDistance([1], [1, 2])).toBe(Infinity);
  });
});
