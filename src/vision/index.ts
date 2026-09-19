import { CalibrationManager } from "./CalibrationManager";
import { CameraService } from "./CameraService";
import { FaceTracker } from "./FaceTracker";
import { GestureClassifier, type GestureClassifierOptions } from "./GestureClassifier";
import { GestureEventEmitter } from "./GestureEventEmitter";
import {
  MotionBridgeError,
  type CalibrationProgress,
  type GestureCommand,
  type GesturePrediction,
  type GestureType,
} from "./types";

export * from "./types";
export { CameraService } from "./CameraService";
export { FaceTracker } from "./FaceTracker";
export { CalibrationManager } from "./CalibrationManager";
export { GestureClassifier } from "./GestureClassifier";
export { GestureEventEmitter } from "./GestureEventEmitter";

export type MotionBridgeController = {
  beginNeutralCalibration(): void;
  beginGestureCalibration(type: GestureType): void;
  getCalibrationProgress(): CalibrationProgress;
  getLatestPrediction(): GesturePrediction;
  isReady(): boolean;
  stop(): void;
};

export type MotionBridgeOptions = {
  classifier?: GestureClassifierOptions;
  modelAssetPath?: string;
  wasmBasePath?: string;
  neutralRequired?: number;
  gestureRequired?: number;
};

/** Starts the complete webcam → MediaPipe → personalized gesture pipeline. */
export async function startMotionBridge(
  videoElement: HTMLVideoElement,
  onCommand: (event: GestureCommand) => void,
  options: MotionBridgeOptions = {},
): Promise<MotionBridgeController> {
  const camera = new CameraService(videoElement);
  const tracker = new FaceTracker({
    modelAssetPath: options.modelAssetPath,
    wasmBasePath: options.wasmBasePath,
  });
  const calibration = new CalibrationManager({
    neutralRequired: options.neutralRequired,
    gestureRequired: options.gestureRequired,
  });
  const emitter = new GestureEventEmitter();
  emitter.subscribe(onCommand);

  let latestPrediction: GesturePrediction = { label: "UNKNOWN", confidence: 0 };
  let calibrationMode: "NEUTRAL" | GestureType | undefined;
  let classifierConfigured = false;
  let animationHandle: number | undefined;
  let stopped = false;

  const classifier = new GestureClassifier({
    ...options.classifier,
    onGesture: (prediction) => {
      if (prediction.label === "NEXT") emitter.emitNext(prediction.confidence);
      if (prediction.label === "SELECT") emitter.emitSelect(prediction.confidence);
    },
    onNeutral: () => emitter.emitNeutral(),
  });

  try {
    await camera.startCamera();
    await tracker.initializeModel();
  } catch (error) {
    camera.stopCamera();
    throw error;
  }

  const controller: MotionBridgeController = {
    beginNeutralCalibration: () => {
      calibration.resetCalibration();
      classifier.resetTriggerState();
      classifierConfigured = false;
      calibrationMode = "NEUTRAL";
    },
    beginGestureCalibration: (type) => {
      if (!calibration.calculateNeutralVector().length) {
        throw new MotionBridgeError("INVALID_FEATURES", "Capture neutral samples before teaching a gesture.");
      }
      calibrationMode = type;
    },
    getCalibrationProgress: () => calibration.getProgress(),
    getLatestPrediction: () => ({ ...latestPrediction }),
    isReady: () => calibration.isCalibrationComplete(),
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (animationHandle !== undefined) cancelAnimationFrame(animationHandle);
      camera.stopCamera();
      emitter.unsubscribe(onCommand);
    },
  };

  const processLoop = (): void => {
    if (stopped) return;
    try {
      const features = tracker.processFrame(camera.getCurrentFrame());
      if (calibrationMode) {
        if (calibrationMode === "NEUTRAL") calibration.captureNeutral(features.vector);
        else calibration.captureGesture(calibrationMode, features.vector);
        const progress = calibration.getProgress();
        if (
          (calibrationMode === "NEUTRAL" && progress.neutral >= progress.neutralRequired) ||
          (calibrationMode !== "NEUTRAL" &&
            progress[calibrationMode.toLowerCase() as "next" | "select"] >= progress.gestureRequired)
        ) {
          calibrationMode = undefined;
        }
      } else if (calibration.isCalibrationComplete()) {
        if (!classifierConfigured) {
          classifier.setPrototypes({
            neutral: calibration.getPrototype("NEUTRAL"),
            next: calibration.getPrototype("NEXT"),
            select: calibration.getPrototype("SELECT"),
          });
          classifierConfigured = true;
        }
        latestPrediction = classifier.update(calibration.normalizeFeatures(features.vector));
      } else {
        latestPrediction = { label: "UNKNOWN", confidence: 0 };
      }
    } catch (error) {
      if (!(error instanceof MotionBridgeError && error.code === "NO_FACE_DETECTED")) {
        latestPrediction = { label: "UNKNOWN", confidence: 0 };
      }
    }
    animationHandle = requestAnimationFrame(processLoop);
  };

  animationHandle = requestAnimationFrame(processLoop);
  return controller;
}
