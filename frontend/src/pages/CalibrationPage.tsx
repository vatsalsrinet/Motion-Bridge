import { useEffect } from "react";
import { CalibrationPanel } from "../components/CalibrationPanel";
import type { CalibrationStage } from "../types/motionBridge";

interface CalibrationPageProps {
  stage: CalibrationStage;
  captured: number;
  required: number;
  error: string | null;
  /** True once this stage has captured everything it needs. */
  complete: boolean;
  /** True once the tracker is running and able to accept a start command. */
  ready: boolean;
  onStart: () => void;
  onContinue: () => void;
  onSkip: () => void;
  camera: React.ReactNode;
}

const COPY: Record<CalibrationStage, { eyebrow: string; title: string; instruction: string; unit: string }> = {
  NEUTRAL: {
    eyebrow: "Step 1 of 3",
    title: "Hold still for a moment",
    instruction:
      "Look at the camera and keep your face relaxed and still. MotionBridge is learning what your resting position looks like, so it can tell when you move on purpose.",
    unit: "neutral samples captured"
  },
  NEXT: {
    eyebrow: "Step 2 of 3",
    title: "Teach your NEXT movement",
    instruction:
      "Choose any small movement you can repeat comfortably — a head tilt, a raised eyebrow, a look to one side. Perform it, return to rest, and repeat. This movement will move the focus between results.",
    unit: "NEXT samples captured"
  },
  SELECT: {
    eyebrow: "Step 3 of 3",
    title: "Teach your SELECT movement",
    instruction:
      "Now choose a clearly different movement. The more distinct it is from your NEXT movement, the more reliably MotionBridge can tell them apart. This one opens the focused result.",
    unit: "SELECT samples captured"
  }
};

export const CalibrationPage = ({
  stage,
  captured,
  required,
  error,
  complete,
  ready,
  onStart,
  onContinue,
  onSkip,
  camera
}: CalibrationPageProps) => {
  const copy = COPY[stage];

  // Begin capturing once this stage is on screen *and* the tracker is running.
  // The camera takes a moment to come up, so starting on mount alone would
  // send the command into a controller that does not exist yet.
  useEffect(() => {
    if (!ready) return;
    onStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, ready]);

  return (
    <div className="calibration">
      <div>{camera}</div>

      <div className="stack">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 style={{ fontSize: "var(--text-xl)" }}>{copy.title}</h2>
          <p className="calibration__instruction">{copy.instruction}</p>
        </div>

        <CalibrationPanel captured={captured} required={required} unit={copy.unit} />

        {error && (
          <div className="notice notice--error" role="alert">
            <p className="notice__title">
              <span aria-hidden="true">!</span> Calibration problem
            </p>
            <p className="notice__body">{error}</p>
          </div>
        )}

        <div className="row">
          <button
            type="button"
            className="button button--primary"
            onClick={onContinue}
            disabled={!complete}
          >
            {complete ? "Continue" : ready ? "Waiting for samples…" : "Starting camera…"}
          </button>
          <button type="button" className="button button--ghost" onClick={onSkip}>
            Skip this step
          </button>
        </div>

        <p className="search__hint">
          Skipping is fine — the keyboard controls work regardless of calibration.
        </p>
      </div>
    </div>
  );
};
