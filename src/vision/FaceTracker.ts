import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  DEFAULT_BLENDSHAPE_NAMES,
  MotionBridgeError,
  type FaceFeatures,
  type HeadPose,
} from "./types";

export type FaceTrackerOptions = {
  modelAssetPath?: string;
  wasmBasePath?: string;
  blendshapeNames?: readonly string[];
};

const DEFAULT_MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const DEFAULT_WASM_BASE_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";

/** Converts a MediaPipe Face Landmarker result into a small numeric feature vector. */
export class FaceTracker {
  private faceLandmarker?: FaceLandmarker;
  private latestResult?: FaceLandmarkerResult;
  private latestBlendshapes: number[] = [];
  private latestHeadPose: HeadPose = { yaw: 0, pitch: 0, roll: 0 };
  private latestVector: number[] = [];
  private modelPromise?: Promise<void>;
  private readonly blendshapeNames: readonly string[];

  constructor(private readonly options: FaceTrackerOptions = {}) {
    this.blendshapeNames = options.blendshapeNames ?? DEFAULT_BLENDSHAPE_NAMES;
  }

  async initializeModel(): Promise<void> {
    if (this.faceLandmarker) return;
    if (this.modelPromise) return this.modelPromise;

    this.modelPromise = this.createModel();
    try {
      await this.modelPromise;
    } catch (error) {
      this.modelPromise = undefined;
      throw error;
    }
  }

  processFrame(frame: ImageData): FaceFeatures {
    if (!this.faceLandmarker) {
      throw new MotionBridgeError(
        "MODEL_INITIALIZATION_FAILED",
        "Face Landmarker is not initialized. Call initializeModel() first.",
      );
    }
    if (!frame.width || !frame.height || frame.data.length !== frame.width * frame.height * 4) {
      throw new MotionBridgeError("INVALID_FEATURES", "The camera frame is invalid.");
    }

    const result = this.faceLandmarker.detect(frame);
    if (!result.faceLandmarks.length) {
      this.latestResult = undefined;
      this.latestVector = [];
      throw new MotionBridgeError("NO_FACE_DETECTED", "No face was detected in the camera frame.");
    }

    this.latestResult = result;
    this.latestBlendshapes = this.extractBlendshapes();
    this.latestHeadPose = this.calculateHeadPose();
    this.latestVector = [
      ...this.latestBlendshapes,
      this.latestHeadPose.yaw,
      this.latestHeadPose.pitch,
      this.latestHeadPose.roll,
    ];
    if (!this.latestVector.every(Number.isFinite)) {
      throw new MotionBridgeError("INVALID_FEATURES", "MediaPipe returned an invalid feature vector.");
    }

    return {
      vector: [...this.latestVector],
      headPose: { ...this.latestHeadPose },
      blendshapes: [...this.latestBlendshapes],
    };
  }

  extractBlendshapes(): number[] {
    const categories = this.latestResult?.faceBlendshapes[0]?.categories ?? [];
    const byName = new Map(categories.map((category) => [category.categoryName, category.score]));
    return this.blendshapeNames.map((name) => byName.get(name) ?? 0);
  }

  calculateHeadPose(): HeadPose {
    const matrix = this.latestResult?.facialTransformationMatrixes[0];
    if (matrix && matrix.rows >= 3 && matrix.columns >= 3 && matrix.data.length >= 16) {
      return eulerFromMatrix(matrix.data);
    }

    const landmarks = this.latestResult?.faceLandmarks[0];
    if (!landmarks) return { yaw: 0, pitch: 0, roll: 0 };
    return poseFromLandmarks(landmarks);
  }

  getFeatureVector(): number[] {
    return [...this.latestVector];
  }

  private async createModel(): Promise<void> {
    try {
      const fileset = await FilesetResolver.forVisionTasks(
        this.options.wasmBasePath ?? DEFAULT_WASM_BASE_PATH,
      );
      this.faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: this.options.modelAssetPath ?? DEFAULT_MODEL_ASSET_PATH },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch (error) {
      throw new MotionBridgeError(
        "MODEL_INITIALIZATION_FAILED",
        "MediaPipe Face Landmarker could not be initialized.",
        { cause: error },
      );
    }
  }
}

function eulerFromMatrix(data: number[]): HeadPose {
  // MediaPipe returns a row-major 4x4 rigid transform. Convert radians to degrees.
  const r00 = data[0];
  const r10 = data[4];
  const r20 = data[8];
  const r21 = data[9];
  const r22 = data[10];
  const pitch = Math.asin(clamp(-r20, -1, 1));
  return {
    yaw: radiansToDegrees(Math.atan2(r10, r00)),
    pitch: radiansToDegrees(pitch),
    roll: radiansToDegrees(Math.atan2(r21, r22)),
  };
}

function poseFromLandmarks(landmarks: NormalizedLandmark[]): HeadPose {
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[1];
  const forehead = landmarks[10];
  const chin = landmarks[152];
  if (!leftEye || !rightEye || !nose || !forehead || !chin) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const eyeDistance = Math.max(Math.abs(rightEye.x - leftEye.x), 0.001);
  const faceHeight = Math.max(Math.abs(chin.y - forehead.y), 0.001);
  return {
    yaw: ((nose.x - eyeMidX) / eyeDistance) * 55,
    pitch: ((nose.y - eyeMidY) / faceHeight) * 120,
    roll: radiansToDegrees(Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)),
  };
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
