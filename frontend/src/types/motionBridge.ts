/**
 * The surface the frontend needs from Person 1's vision module.
 *
 * Person 1 builds `startMotionBridge` exactly as described in their brief. The
 * frontend never imports MediaPipe or anything under src/vision on their side —
 * it only ever touches this interface, so the two halves can be built in
 * parallel and swapped in with one call to `registerMotionBridge`.
 */

import type { GestureCommand, GestureType } from "./contracts";

export type CalibrationStage = "NEUTRAL" | GestureType;

export interface CalibrationProgress {
  stage: CalibrationStage;
  /** Samples captured so far. */
  captured: number;
  /** Samples needed before this stage is complete. */
  required: number;
  /** True on the update that completes the stage. */
  complete: boolean;
}

export interface CalibrationScores {
  /** 0..1 separability of the NEXT prototype from neutral. Optional. */
  nextScore?: number;
  /** 0..1 separability of the SELECT prototype from neutral. Optional. */
  selectScore?: number;
}

export interface MotionBridgeController {
  beginNeutralCalibration(): void;
  beginGestureCalibration(type: GestureType): void;
  isReady(): boolean;
  stop(): void;
  /**
   * Optional. If the vision module reports sample-by-sample progress the
   * calibration screens show real counts; otherwise they fall back to a
   * synthesized count so the flow is still demoable.
   */
  onCalibrationProgress?(callback: (progress: CalibrationProgress) => void): void;
  /** Optional. Drives the separability summary on the Ready screen. */
  getCalibrationScores?(): CalibrationScores;
}

export type StartMotionBridge = (
  videoElement: HTMLVideoElement,
  onCommand: (event: GestureCommand) => void
) => Promise<MotionBridgeController>;
