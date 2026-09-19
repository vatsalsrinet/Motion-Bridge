import type {
  CalibrationProgress,
  GestureCommand,
  GestureLabel,
  GesturePrediction,
  MotionBridgeRuntimeStatus,
} from "./types";

type BackendPrediction = {
  type: "prediction";
  prediction: GestureLabel;
  confidence: number;
  scores?: Record<string, number>;
  distances?: Record<string, number>;
  face_detected?: boolean;
};

type BackendProgress = {
  type: "calibration_progress";
  gesture: string;
  current: number;
  required: number;
  phase: string;
  quality: number;
  next_quality: number;
  select_quality: number;
  ready: boolean;
  issue?: string | null;
  neutral_current: number;
  neutral_required: number;
  next_current: number;
  select_current: number;
  gesture_required: number;
};

type BackendEvent = {
  type: "event";
  command: "NEXT" | "SELECT" | "NEUTRAL";
  confidence: number;
};

type BackendMessage = BackendPrediction | BackendProgress | BackendEvent | { type: "error"; message: string; code?: string };

export type PythonVisionClientOptions = {
  url: string;
  onPrediction: (prediction: GesturePrediction) => void;
  onProgress: (progress: CalibrationProgress & { mode: string; phase: string; quality: number; nextQuality: number; selectQuality: number; ready: boolean; issue?: string }) => void;
  onEvent: (event: GestureCommand) => void;
  onRuntime: (status: Partial<MotionBridgeRuntimeStatus>) => void;
  onError: (message: string) => void;
};

export class PythonVisionClient {
  private socket?: WebSocket;
  private readonly options: PythonVisionClientOptions;

  constructor(options: PythonVisionClientOptions) {
    this.options = options;
  }

  connect(timeoutMs = 5000): Promise<void> {
    if (typeof WebSocket === "undefined") return Promise.reject(new Error("WebSocket is unavailable in this browser."));
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.options.url);
      this.socket = socket;
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.close();
          reject(new Error("Python vision backend is unavailable."));
        }
      }, timeoutMs);
      socket.onopen = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        this.options.onRuntime({ backendConnected: true });
        resolve();
      };
      socket.onmessage = (event) => this.handleMessage(JSON.parse(event.data as string) as BackendMessage);
      socket.onerror = () => {
        this.options.onError("Python vision backend connection failed.");
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          reject(new Error("Python vision backend is unavailable."));
        }
      };
      socket.onclose = () => this.options.onRuntime({ backendConnected: false });
    });
  }

  sendFrame(image: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "frame", image }));
  }

  beginCalibration(gesture: "NEUTRAL" | "NEXT" | "SELECT"): void {
    this.send({ type: "start_calibration", gesture });
  }

  reset(): void {
    this.send({ type: "reset" });
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
  }

  private send(message: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
    else this.options.onError("Python vision backend is not connected.");
  }

  private handleMessage(message: BackendMessage): void {
    if (message.type === "prediction") {
      const scores = {
        NEUTRAL: Number(message.scores?.NEUTRAL ?? 0),
        NEXT: Number(message.scores?.NEXT ?? 0),
        SELECT: Number(message.scores?.SELECT ?? 0),
      };
      this.options.onPrediction({
        label: message.prediction,
        confidence: Math.max(0, Math.min(1, Number(message.confidence) / 100)),
        classScores: scores,
        distances: message.distances as GesturePrediction["distances"],
      });
      this.options.onRuntime({ faceDetected: Boolean(message.face_detected) });
    } else if (message.type === "calibration_progress") {
      const progress: CalibrationProgress = {
        neutral: message.neutral_current,
        next: message.next_current,
        select: message.select_current,
        neutralRequired: message.neutral_required,
        gestureRequired: message.gesture_required,
      };
      this.options.onProgress({ ...progress, mode: message.gesture, phase: message.phase, quality: message.quality, nextQuality: message.next_quality, selectQuality: message.select_quality, ready: message.ready, issue: message.issue ?? undefined });
    } else if (message.type === "event") {
      this.options.onEvent({ command: message.command, confidence: Math.max(0, Math.min(1, message.confidence / 100)) });
    } else if (message.type === "error") {
      this.options.onError(message.message);
    }
  }
}
