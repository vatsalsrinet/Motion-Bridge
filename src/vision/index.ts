import { CalibrationManager } from "./CalibrationManager";
import { euclideanDistance } from "./CalibrationManager";
import { CameraService } from "./CameraService";
import { FaceTracker } from "./FaceTracker";
import { GestureClassifier, type GestureClassifierOptions } from "./GestureClassifier";
import { GestureEventEmitter } from "./GestureEventEmitter";
import {
  MotionBridgeError,
  type CalibrationState,
  type CalibrationProgress,
  type GestureCapturePhase,
  type GestureCommand,
  type GesturePrediction,
  type GestureType,
  type MotionBridgeRuntimeStatus,
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
  getCalibrationState(): CalibrationState;
  getRuntimeStatus(): MotionBridgeRuntimeStatus;
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
  let capturePhase: GestureCapturePhase = "IDLE";
  let faceDetected = false;
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
      capturePhase = "COLLECTING";
      latestPrediction = { label: "UNKNOWN", confidence: 0 };
    },
    beginGestureCalibration: (type) => {
      const progress = calibration.getProgress();
      if (progress.neutral < progress.neutralRequired) {
        throw new MotionBridgeError("INVALID_FEATURES", "Capture neutral samples before teaching a gesture.");
      }
      calibration.resetGesture(type);
      classifier.resetTriggerState();
      classifierConfigured = false;
      calibrationMode = type;
      capturePhase = "COLLECTING";
      latestPrediction = { label: "UNKNOWN", confidence: 0 };
    },
    getCalibrationProgress: () => calibration.getProgress(),
    getCalibrationState: () => {
      const progress = calibration.getProgress();
      const ready = calibrationMode === undefined && calibration.isCalibrationComplete();
      const enoughGestures = progress.next >= progress.gestureRequired && progress.select >= progress.gestureRequired;
      return {
        mode: calibrationMode ?? "IDLE",
        phase: capturePhase,
        progress,
        nextSeparability: calibration.getSeparability("NEXT"),
        selectSeparability: calibration.getSeparability("SELECT"),
        ready,
        issue: !ready && enoughGestures
          ? "These gestures are difficult to distinguish. Please recalibrate SELECT."
          : undefined,
      };
    },
    getRuntimeStatus: () => ({ cameraActive: camera.isCameraActive(), faceDetected }),
    getLatestPrediction: () => ({ ...latestPrediction }),
    isReady: () => calibrationMode === undefined && calibration.isCalibrationComplete(),
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
      faceDetected = true;
      if (calibrationMode) {
        if (calibrationMode === "NEUTRAL") {
          calibration.captureNeutral(features.vector);
        } else {
          const normalized = calibration.normalizeFeatures(features.vector);
          const movementMagnitude = euclideanDistance(normalized, normalized.map(() => 0));
          if (capturePhase === "COLLECTING" && movementMagnitude >= 2.5) {
            calibration.captureGesture(calibrationMode, features.vector);
            capturePhase = "WAITING_FOR_NEUTRAL";
          } else if (capturePhase === "WAITING_FOR_NEUTRAL" && movementMagnitude <= 1.1) {
            capturePhase = "COLLECTING";
          }
        }
        const progress = calibration.getProgress();
        if (
          (calibrationMode === "NEUTRAL" && progress.neutral >= progress.neutralRequired) ||
          (calibrationMode !== "NEUTRAL" &&
            capturePhase === "COLLECTING" &&
            progress[calibrationMode.toLowerCase() as "next" | "select"] >= progress.gestureRequired)
        ) {
          calibrationMode = undefined;
          capturePhase = "IDLE";
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
      faceDetected = !(error instanceof MotionBridgeError && error.code === "NO_FACE_DETECTED")
        ? faceDetected
        : false;
      if (!(error instanceof MotionBridgeError && error.code === "NO_FACE_DETECTED")) {
        latestPrediction = { label: "UNKNOWN", confidence: 0 };
      }
    }
    animationHandle = requestAnimationFrame(processLoop);
  };

  animationHandle = requestAnimationFrame(processLoop);
  return controller;
}
