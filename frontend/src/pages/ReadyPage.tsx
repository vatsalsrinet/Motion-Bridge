import type { CalibrationState } from "../app/AppController";

interface ReadyPageProps {
  calibration: CalibrationState;
  onContinue: () => void;
  onRecalibrate: () => void;
}

const formatScore = (score: number | undefined): string | null => {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return `${Math.round(score * 100)}%`;
};

/**
 * Confirms what was learned. Scores are optional — when the vision module
 * reports no separability the line is omitted rather than filled with a
 * placeholder number that would misrepresent the system.
 */
export const ReadyPage = ({ calibration, onContinue, onRecalibrate }: ReadyPageProps) => {
  const items = [
    {
      label: "NEXT movement learned",
      hint: "Moves the focus between results",
      done: calibration.nextDone,
      score: formatScore(calibration.scores.nextScore)
    },
    {
      label: "SELECT movement learned",
      hint: "Opens the focused result",
      done: calibration.selectDone,
      score: formatScore(calibration.scores.selectScore)
    }
  ];

  return (
    <div className="calibration">
      <div>
        <p className="eyebrow">Calibration complete</p>
        <h2 className="display" style={{ fontSize: "var(--text-2xl)" }}>
          MotionBridge knows <em>your movements.</em>
        </h2>
        <p className="lede" style={{ marginTop: "var(--space-5)", maxWidth: "40ch" }}>
          Separability is how distinct each movement is from your resting face. Higher is more
          reliable.
        </p>
      </div>

      <div>
        <ul className="checklist">
          {items.map((item) => (
            <li
              key={item.label}
              className={item.done ? "checklist__item" : "checklist__item checklist__item--skipped"}
            >
              <span className="checklist__icon" aria-hidden="true">
                {item.done ? "✓" : "–"}
              </span>
              <div className="checklist__text">
                <div className="checklist__name">
                  {item.label}
                  <span className="sr-only">: {item.done ? "complete" : "skipped"}</span>
                </div>
                <div className="checklist__hint">{item.hint}</div>
              </div>
              {item.score && (
                <div className="checklist__score">
                  <b>{item.score}</b>
                  <span>Separable</span>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="keys">
          <p className="label">Keyboard equivalents</p>
          <ul className="keys__list">
            <li className="keys__item">
              <span className="keys__key">&#8595;</span>
              <span>Next result</span>
            </li>
            <li className="keys__item">
              <span className="keys__key">Enter</span>
              <span>Open result</span>
            </li>
            <li className="keys__item">
              <span className="keys__key">Esc</span>
              <span>Go back</span>
            </li>
          </ul>
        </div>

        <div className="row" style={{ marginTop: "var(--space-6)", gap: "var(--space-5)" }}>
          <button type="button" className="button button--primary button--large" onClick={onContinue}>
            Continue to campus search
            <span aria-hidden="true">&#8594;</span>
          </button>
          <button type="button" className="button button--ghost" onClick={onRecalibrate}>
            Calibrate again
          </button>
        </div>
      </div>
    </div>
  );
};
