import { useEffect, useRef, useState } from "react";

type CameraStatus = "idle" | "requesting" | "live" | "denied" | "missing" | "error";

interface CameraPanelProps {
  /** Hands the live <video> up to the parent so the vision module can attach. */
  onVideoReady: (element: HTMLVideoElement | null) => void;
  /** Lets the user abandon the camera and keep going on the keyboard. */
  onSkip?: () => void;
}

const MESSAGES: Record<Exclude<CameraStatus, "live">, { title: string; body: string }> = {
  idle: {
    title: "Camera not started",
    body: "MotionBridge needs your webcam to learn your movements."
  },
  requesting: {
    title: "Waiting for camera permission",
    body: "Your browser is asking whether this page can use the camera. Choose Allow."
  },
  denied: {
    title: "Camera permission denied",
    body: "MotionBridge cannot see your movements. You can still use the whole app with the keyboard."
  },
  missing: {
    title: "No camera found",
    body: "No webcam is connected to this device. You can still use the whole app with the keyboard."
  },
  error: {
    title: "Camera could not start",
    body: "Something went wrong reaching the webcam. You can still use the whole app with the keyboard."
  }
};

/**
 * Owns getUserMedia and the three failure modes that actually break live
 * demos: permission pending, permission refused, and no device at all. Every
 * failure offers a keyboard escape hatch rather than dead-ending.
 */
export const CameraPanel = ({ onVideoReady, onSkip }: CameraPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("missing");
        return;
      }

      setStatus("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          onVideoReady(videoRef.current);
        }
        setStatus("live");
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied");
        else if (name === "NotFoundError" || name === "DevicesNotFoundError") setStatus("missing");
        else setStatus("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      onVideoReady(null);
    };
    // onVideoReady is stable (useCallback in the parent); the camera must start once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = status === "live";

  return (
    <div className="camera">
      <video
        ref={videoRef}
        className={live ? "camera__video" : "camera__video camera__video--hidden"}
        playsInline
        muted
        // Decorative: the instructions beside it carry the meaning.
        aria-hidden="true"
      />

      {live ? (
        <p className="camera__badge">
          <span className="camera__dot" aria-hidden="true" />
          Camera live
        </p>
      ) : (
        <div className="camera__message" role="status">
          <strong>{MESSAGES[status].title}</strong>
          <p>{MESSAGES[status].body}</p>
          {onSkip && (status === "denied" || status === "missing" || status === "error") && (
            <button type="button" className="button button--ghost" onClick={onSkip}>
              Continue with keyboard instead
            </button>
          )}
        </div>
      )}
    </div>
  );
};
