import { startMockMotionBridge } from "../mocks/mockMotionBridge";
import type { CalibrationProgress, CalibrationScores } from "../types/motionBridge";
import type { GestureCommand, GestureType } from "../types/contracts";
import type { StartMotionBridge, MotionBridgeController } from "../types/motionBridge";

let registered: StartMotionBridge | null = null;
export const registerMotionBridge = (start: StartMotionBridge): void => { registered = start; };
export const isMotionBridgeRegistered = (): boolean => registered !== null;

const useMocks = () => import.meta.env.VITE_USE_MOCKS === "true" || new URLSearchParams(window.location.search).get("mock") === "1";

const visionUrl = (): string => {
  if (import.meta.env.VITE_VISION_WS_URL) return import.meta.env.VITE_VISION_WS_URL;
  return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8000/ws/vision`;
};

type BackendMessage = { type: string; gesture?: string; current?: number; required?: number; neutral_current?: number; neutral_required?: number; next_current?: number; select_current?: number; gesture_required?: number; next_quality?: number; select_quality?: number; ready?: boolean; issue?: string | null; command?: GestureCommand["command"]; confidence?: number; };

const startRealMotionBridge: StartMotionBridge = (videoElement, onCommand) => new Promise((resolve, reject) => {
  const socket = new WebSocket(visionUrl());
  const canvas = document.createElement("canvas");
  const progressListeners = new Set<(progress: CalibrationProgress) => void>();
  let progress: CalibrationProgress = { stage: "NEUTRAL", captured: 0, required: 80, complete: false };
  let scores: CalibrationScores = {};
  let timer: number | undefined;
  let ready = false;
  let settled = false;
  const timeout = window.setTimeout(() => { if (!settled) { socket.close(); reject(new Error("Vision backend is unavailable. Start Python vision with `python -m vision_backend.main`.")); } }, 6000);
  const notify = () => progressListeners.forEach((listener) => listener(progress));
  const send = (message: object) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
  const controller: MotionBridgeController = {
    beginNeutralCalibration: () => send({ type: "start_calibration", gesture: "NEUTRAL" }),
    beginGestureCalibration: (gesture: GestureType) => send({ type: "start_calibration", gesture }),
    isReady: () => ready,
    stop: () => { if (timer !== undefined) window.clearInterval(timer); socket.close(); },
    onCalibrationProgress: (listener) => { progressListeners.add(listener); listener(progress); },
    getCalibrationScores: () => scores
  };
  socket.onopen = () => {
    settled = true; window.clearTimeout(timeout);
    timer = window.setInterval(() => {
      const width = videoElement.videoWidth || videoElement.clientWidth;
      const height = videoElement.videoHeight || videoElement.clientHeight;
      if (!width || !height) return;
      canvas.width = Math.min(640, width); canvas.height = Math.round((canvas.width / width) * height);
      const context = canvas.getContext("2d"); if (!context) return;
      context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      send({ type: "frame", image: canvas.toDataURL("image/jpeg", 0.72) });
    }, 1000 / 12);
    resolve(controller);
  };
  socket.onerror = () => { if (!settled) { settled = true; window.clearTimeout(timeout); reject(new Error("Vision backend connection failed.")); } };
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data as string) as BackendMessage;
    if (message.type === "calibration_progress") {
      const stage = message.gesture === "NEXT" || message.gesture === "SELECT" ? message.gesture : "NEUTRAL";
      const captured = stage === "NEUTRAL" ? message.neutral_current ?? 0 : stage === "NEXT" ? message.next_current ?? 0 : message.select_current ?? 0;
      const required = stage === "NEUTRAL" ? message.neutral_required ?? 80 : message.gesture_required ?? 5;
      progress = { stage, captured, required, complete: captured >= required };
      ready = Boolean(message.ready); scores = { nextScore: (message.next_quality ?? 0) / 100, selectScore: (message.select_quality ?? 0) / 100 }; notify();
    } else if (message.type === "event" && message.command) onCommand({ command: message.command, confidence: Math.max(0, Math.min(1, (message.confidence ?? 0) / 100)) });
  };
});

export const getMotionBridge = (): StartMotionBridge => registered ?? (useMocks() ? startMockMotionBridge : startRealMotionBridge);
