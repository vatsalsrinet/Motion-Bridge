import { CameraService } from "./CameraService";
import { GestureEventEmitter } from "./GestureEventEmitter";
import { PythonVisionClient } from "./PythonVisionClient";
import type {
  CalibrationProgress,
  CalibrationState,
  GestureCommand,
  GesturePrediction,
  GestureType,
  MotionBridgeRuntimeStatus,
} from "./types";

export * from "./types";
export { CameraService } from "./CameraService";
export { GestureEventEmitter } from "./GestureEventEmitter";
export { PythonVisionClient } from "./PythonVisionClient";

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
  backendUrl?: string;
  frameRate?: number;
};

const defaultProgress: CalibrationProgress = {
  neutral: 0,
  next: 0,
  select: 0,
  neutralRequired: 80,
  gestureRequired: 5,
};

/** Browser-side transport wrapper. Python owns all face processing and classification. */
export async function startMotionBridge(
  videoElement: HTMLVideoElement,
  onCommand: (event: GestureCommand) => void,
  options: MotionBridgeOptions = {},
): Promise<MotionBridgeController> {
  const camera = new CameraService(videoElement);
  const emitter = new GestureEventEmitter();
  emitter.subscribe(onCommand);
  let progress = { ...defaultProgress };
  let mode: CalibrationState["mode"] = "IDLE";
  let phase: CalibrationState["phase"] = "IDLE";
  let quality = { next: 0, select: 0 };
  let issue: string | undefined;
  let ready = false;
  let latestPrediction: GesturePrediction = { label: "UNKNOWN", confidence: 0 };
  let runtime: MotionBridgeRuntimeStatus = { cameraActive: false, faceDetected: false, backendConnected: false };
  let frameTimer: number | undefined;
  let stopped = false;

  const client = new PythonVisionClient({
    url: options.backendUrl ?? defaultBackendUrl(),
    onPrediction: (prediction) => {
      latestPrediction = prediction;
      runtime.faceDetected = Boolean(runtime.faceDetected);
    },
    onProgress: (message) => {
      progress = {
        neutral: message.neutral,
        next: message.next,
        select: message.select,
        neutralRequired: message.neutralRequired,
        gestureRequired: message.gestureRequired,
      };
      mode = message.mode === "NEUTRAL" || message.mode === "NEXT" || message.mode === "SELECT" ? message.mode : "IDLE";
      phase = message.phase as CalibrationState["phase"];
      quality = { next: message.nextQuality, select: message.selectQuality };
      issue = message.issue;
      ready = message.ready;
    },
    onEvent: (event) => {
      if (event.command === "NEXT") emitter.emitNext(event.confidence);
      else if (event.command === "SELECT") emitter.emitSelect(event.confidence);
      else emitter.emitNeutral();
    },
    onRuntime: (status) => {
      runtime = { ...runtime, ...status };
    },
    onError: (message) => {
      issue = message;
    },
  });

  await camera.startCamera();
  runtime.cameraActive = camera.isCameraActive();
  try {
    await client.connect();
    const frameRate = Math.max(5, Math.min(15, options.frameRate ?? 12));
    frameTimer = window.setInterval(() => {
      if (stopped) return;
      try {
        client.sendFrame(camera.captureJpeg());
      } catch {
        runtime.cameraActive = camera.isCameraActive();
      }
    }, 1000 / frameRate);
  } catch (error) {
    issue = error instanceof Error ? error.message : "Python vision backend unavailable.";
  }

  const controller: MotionBridgeController = {
    beginNeutralCalibration: () => {
      mode = "NEUTRAL";
      phase = "COLLECTING";
      latestPrediction = { label: "UNKNOWN", confidence: 0 };
      client.beginCalibration("NEUTRAL");
    },
    beginGestureCalibration: (type) => {
      mode = type;
      phase = "COLLECTING";
      latestPrediction = { label: "UNKNOWN", confidence: 0 };
      client.beginCalibration(type);
    },
    getCalibrationProgress: () => ({ ...progress }),
    getCalibrationState: () => ({
      mode,
      phase,
      progress: { ...progress },
      nextSeparability: quality.next,
      selectSeparability: quality.select,
      ready,
      issue,
    }),
    getRuntimeStatus: () => ({ ...runtime, cameraActive: camera.isCameraActive() }),
    getLatestPrediction: () => ({ ...latestPrediction }),
    isReady: () => ready,
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (frameTimer !== undefined) window.clearInterval(frameTimer);
      client.close();
      camera.stopCamera();
      emitter.unsubscribe(onCommand);
      runtime.cameraActive = false;
    },
  };
  return controller;
}

function defaultBackendUrl(): string {
  if (typeof window === "undefined") return "ws://127.0.0.1:8000/ws/vision";
  const hostname = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const port = window.location.port === "5173" ? ":8000" : window.location.port ? `:${window.location.port}` : "";
  return `${protocol}//${hostname}${port}/ws/vision`;
}
