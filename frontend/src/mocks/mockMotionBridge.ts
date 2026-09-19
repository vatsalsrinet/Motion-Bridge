import type { GestureCommand, GestureType } from "../types/contracts";
import type {
  CalibrationProgress,
  CalibrationScores,
  MotionBridgeController,
  StartMotionBridge
} from "../types/motionBridge";

/**
 * A stand-in for Person 1's vision module.
 *
 * It implements the same interface and fakes sample capture on a timer, so the
 * whole calibration flow is demoable and testable before MediaPipe exists. The
 * numbers are simulated; the screens around them are real.
 */

const REQUIRED_SAMPLES: Record<string, number> = {
  NEUTRAL: 5,
  NEXT: 5,
  SELECT: 5
};

const SAMPLE_INTERVAL_MS = 600;

export const createMockMotionBridge = (
  onCommand: (event: GestureCommand) => void
): MotionBridgeController => {
  let progressCallback: ((progress: CalibrationProgress) => void) | null = null;
  let timer: number | null = null;
  let ready = false;
  const completed = new Set<string>();

  const clearTimer = () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const runStage = (stage: "NEUTRAL" | GestureType) => {
    clearTimer();
    const required = REQUIRED_SAMPLES[stage];
    let captured = 0;

    timer = window.setInterval(() => {
      captured += 1;
      const complete = captured >= required;

      if (complete) {
        clearTimer();
        completed.add(stage);
        ready = completed.has("NEUTRAL") && completed.has("NEXT") && completed.has("SELECT");
      }

      progressCallback?.({ stage, captured, required, complete });

      // Echo the gesture being taught so the overlay has something to show.
      if (stage !== "NEUTRAL") {
        onCommand({ command: stage, confidence: 0.82 + Math.random() * 0.15 });
      }
    }, SAMPLE_INTERVAL_MS);
  };

  return {
    beginNeutralCalibration: () => runStage("NEUTRAL"),
    beginGestureCalibration: (type: GestureType) => runStage(type),
    isReady: () => ready,
    stop: () => {
      clearTimer();
      progressCallback = null;
    },
    onCalibrationProgress: (callback) => {
      progressCallback = callback;
    },
    getCalibrationScores: (): CalibrationScores => ({
      nextScore: 0.91,
      selectScore: 0.87
    })
  };
};

export const startMockMotionBridge: StartMotionBridge = async (_videoElement, onCommand) =>
  createMockMotionBridge(onCommand);
