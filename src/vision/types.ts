export type GestureType = "NEXT" | "SELECT";
export type GestureLabel = GestureType | "NEUTRAL" | "UNKNOWN";

export type GestureCommand = {
  command: "NEXT" | "SELECT" | "NEUTRAL";
  confidence: number;
};

export type HeadPose = {
  yaw: number;
  pitch: number;
  roll: number;
};

export type FaceFeatures = {
  vector: number[];
  headPose: HeadPose;
  blendshapes: number[];
};

export type GesturePrediction = {
  label: GestureLabel;
  confidence: number;
  distance?: number;
};

export type CalibrationProgress = {
  neutral: number;
  next: number;
  select: number;
  neutralRequired: number;
  gestureRequired: number;
};

export type MotionBridgeErrorCode =
  | "CAMERA_UNAVAILABLE"
  | "CAMERA_PERMISSION_DENIED"
  | "MODEL_INITIALIZATION_FAILED"
  | "NO_FACE_DETECTED"
  | "INVALID_FEATURES";

export class MotionBridgeError extends Error {
  readonly code: MotionBridgeErrorCode;

  constructor(code: MotionBridgeErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MotionBridgeError";
    this.code = code;
  }
}

export const DEFAULT_BLENDSHAPE_NAMES = [
  "browDownLeft",
  "browDownRight",
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eyeSquintLeft",
  "eyeSquintRight",
  "jawOpen",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthPucker",
  "mouthSmileLeft",
  "mouthSmileRight",
  "noseSneerLeft",
  "noseSneerRight",
] as const;

export const DEFAULT_NEUTRAL_REQUIRED = 45;
export const DEFAULT_GESTURE_REQUIRED = 5;
