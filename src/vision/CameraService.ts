import { MotionBridgeError } from "./types";

/** Owns webcam permissions and supplies snapshots to the tracker. */
export class CameraService {
  private stream?: MediaStream;
  private canvas?: HTMLCanvasElement;

  constructor(private readonly videoElement: HTMLVideoElement) {}

  async startCamera(): Promise<void> {
    if (this.isCameraActive()) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MotionBridgeError(
        "CAMERA_UNAVAILABLE",
        "This browser does not provide webcam access.",
      );
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });
      this.videoElement.srcObject = this.stream;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      await this.videoElement.play();
    } catch (error) {
      this.stopCamera();
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new MotionBridgeError(
          "CAMERA_PERMISSION_DENIED",
          "Camera permission was denied. Allow webcam access and try again.",
          { cause: error },
        );
      }
      throw new MotionBridgeError(
        "CAMERA_UNAVAILABLE",
        "The webcam could not be started. Check that a camera is connected.",
        { cause: error },
      );
    }
  }

  stopCamera(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = undefined;
    this.videoElement.srcObject = null;
  }

  getCurrentFrame(): ImageData {
    if (!this.isCameraActive()) {
      throw new MotionBridgeError("CAMERA_UNAVAILABLE", "The webcam is not active.");
    }

    const width = this.videoElement.videoWidth || this.videoElement.clientWidth;
    const height = this.videoElement.videoHeight || this.videoElement.clientHeight;
    if (!width || !height) {
      throw new MotionBridgeError(
        "CAMERA_UNAVAILABLE",
        "The webcam is active but has not produced a frame yet.",
      );
    }

    this.canvas ??= document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const context = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new MotionBridgeError("CAMERA_UNAVAILABLE", "Canvas capture is unavailable.");
    context.drawImage(this.videoElement, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  }

  isCameraActive(): boolean {
    return (this.stream?.getTracks().some((track) => track.readyState === "live") ?? false);
  }
}
