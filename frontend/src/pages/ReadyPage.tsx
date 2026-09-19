import type { CalibrationState } from "../app/AppController";

interface ReadyPageProps {
  calibration: CalibrationState;
  onContinue: () => void;
  onRecalibrate: () => void;
}

const formatScore = (score: number | undefined): string | null => {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return `${Math.round(score * 100)}% separable from neutral`;
};

/**
 * Confirms what was learned. Scores are optional — if the vision module does
 * not report separability, the summary simply omits it rather than showing
 * a placeholder number that would misrepresent the system.
 */
export const ReadyPage = ({ calibration, onContinue, onRecalibrate }: ReadyPageProps) => {
  const nextScore = formatScore(calibration.scores.nextScore);
  const selectScore = formatScore(calibration.scores.selectScore);

  const items = [
    { label: "NEXT movement learned", done: calibration.nextDone, score: nextScore },
    { label: "SELECT movement learned", done: calibration.selectDone, score: selectScore }
  ];

  return (
    <div className="stack">
      <header>
        <p className="eyebrow">Calibration complete</p>
        <h2 style={{ fontSize: "var(--text-2xl)" }}>MotionBridge knows your movements</h2>
      </header>

      <ul className="checklist">
        {items.map((item) => (
          <li
            key={item.label}
            className={item.done ? "checklist__item checklist__item--done" : "checklist__item"}
          >
            <span className="checklist__icon" aria-hidden="true">
              {item.done ? "✓" : "–"}
            </span>
            <span>
              {item.label}
              <span className="sr-only">: {item.done ? "complete" : "skipped"}</span>
            </span>
            {item.score && <span className="checklist__score">{item.score}</span>}
          </li>
        ))}
      </ul>

      <div className="panel">
        <h3 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-2)" }}>
          How to drive the next screen
        </h3>
        <p className="search__hint" style={{ margin: 0 }}>
          Your NEXT movement moves the focus between results. Your SELECT movement opens the
          focused result. Arrow keys and Enter do exactly the same thing if you would rather use
          the keyboard.
        </p>
      </div>

      <div className="row">
        <button type="button" className="button button--primary button--large" onClick={onContinue}>
          Continue to campus search
        </button>
        <button type="button" className="button button--ghost" onClick={onRecalibrate}>
          Calibrate again
        </button>
      </div>
    </div>
  );
};
