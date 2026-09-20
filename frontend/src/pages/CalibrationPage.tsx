import { useEffect } from "react";
import type { ReactNode } from "react";
import { CalibrationPanel } from "../components/CalibrationPanel";
import type { CalibrationStage } from "../types/motionBridge";

interface CalibrationPageProps {
  stage: CalibrationStage;
  captured: number;
  required: number;
  phase: "IDLE" | "COLLECTING" | "WINDOW" | "WAITING_FOR_NEUTRAL";
  error: string | null;
  /** True once this stage has captured everything it needs. */
  complete: boolean;
  /** True once the tracker is running and able to accept a start command. */
  ready: boolean;
  onStart: () => void;
  onContinue: () => void;
  onSkip: () => void;
}

const STAGES: CalibrationStage[] = ["NEUTRAL", "NEXT", "SELECT"];

const COPY: Record<
  CalibrationStage,
  { step: string; rail: string; title: ReactNode; instruction: string; unit: string }
> = {
  NEUTRAL: {
    step: "Step 01 of 03",
    rail: "Neutral",
    title: <>Hold still for a moment</>,
    instruction:
      "Look at the camera and keep your face relaxed and still. MotionBridge is learning what your resting position looks like, so it can tell when you move on purpose.",
    unit: "Neutral samples captured"
  },
  NEXT: {
    step: "Step 02 of 03",
    rail: "Next",
    title: (
      <>
        Teach your <em>NEXT</em> movement
      </>
    ),
    instruction:
      "Perform it, return to rest, and repeat. Pick something you can do comfortably many times over — a head tilt, a raised eyebrow, a glance to one side.",
    unit: "NEXT samples captured"
  },
  SELECT: {
    step: "Step 03 of 03",
    rail: "Select",
    title: (
      <>
        Teach your <em>SELECT</em> movement
      </>
    ),
    instruction:
      "Now choose a clearly different movement. The more distinct it is from your NEXT movement, the more reliably MotionBridge can tell them apart.",
    unit: "SELECT samples captured"
  }
};

export const CalibrationPage = ({
  stage,
  captured,
  required,
  phase,
  error,
  complete,
  ready,
  onStart,
  onContinue,
  onSkip,
}: CalibrationPageProps) => {
  const copy = COPY[stage];
  const currentIndex = STAGES.indexOf(stage);
  const captureMessage = stage === "NEUTRAL"
    ? complete ? "Neutral baseline captured." : "Stay relaxed and hold still while neutral frames are collected."
    : complete ? `${stage} calibration complete.`
      : phase === "WAITING_FOR_NEUTRAL" ? `Movement captured. Go back to neutral, then perform ${stage} again.`
        : phase === "WINDOW" ? `${stage} detected. Hold the movement briefly.`
          : captured > 0 ? `Neutral detected. Perform your next ${stage} action.`
            : `Perform your ${stage} action, then return to neutral.`;

  // Begin capturing once this stage is on screen *and* the tracker is running.
  // The camera takes a moment to come up, so starting on mount alone would
  // send the command into a controller that does not exist yet.
  useEffect(() => {
    if (!ready) return;
    onStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, ready]);

  return (
    <>
      <ol className="steps">
        {STAGES.map((item, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          const state = done ? "Done" : current ? "Now" : "";
          return (
            <li
              key={item}
              className={
                done
                  ? "steps__item steps__item--done"
                  : current
                    ? "steps__item steps__item--current"
                    : "steps__item"
              }
              aria-current={current ? "step" : undefined}
            >
              <div className="steps__bar" />
              <span className="steps__label">
                {String(index + 1).padStart(2, "0")} {COPY[item].rail}
                {state && ` · ${state}`}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="calibration">
        <div>
          <p className="eyebrow">{copy.step}</p>
          <h2 className="display" style={{ fontSize: "var(--text-xl)" }}>
            {copy.title}
          </h2>
          <p className="calibration__instruction">{copy.instruction}</p>

          <CalibrationPanel captured={captured} required={required} unit={copy.unit} />

          <div className={`capture-status capture-status--${phase.toLowerCase()}`} role="status" aria-live="polite">
            <span className="capture-status__pulse" aria-hidden="true" />
            <div>
              <p className="capture-status__label">Live capture status</p>
              <p className="capture-status__message">{captureMessage}</p>
            </div>
          </div>

          {error && (
            <div className="notice notice--error" role="alert" style={{ marginTop: "var(--space-5)" }}>
              <p className="notice__title">
                <span className="notice__bang" aria-hidden="true">
                  !
                </span>
                Calibration problem
              </p>
              <p className="notice__body">{error}</p>
            </div>
          )}

          <div className="row" style={{ marginTop: "var(--space-6)", gap: "var(--space-5)" }}>
            <button
              type="button"
              className="button button--primary"
              onClick={onContinue}
              disabled={!complete}
            >
              {complete ? "Continue" : ready ? "Waiting for samples" : "Starting camera"}
            </button>
            <button type="button" className="button button--ghost" onClick={onSkip}>
              Skip this step
            </button>
          </div>

          <p className="camera__note">
            Skipping is fine — the keyboard controls work regardless of calibration.
          </p>
        </div>
      </div>
    </>
  );
};
