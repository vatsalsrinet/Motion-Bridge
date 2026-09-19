interface CalibrationPanelProps {
  captured: number;
  required: number;
  /** Shown as the progress caption, e.g. "NEXT samples captured". */
  unit: string;
}

/**
 * Sample progress. Shows the ratio as a large mono count and as a row of
 * bars, and exposes it as a progressbar so the count reaches assistive tech
 * too.
 */
export const CalibrationPanel = ({ captured, required, unit }: CalibrationPanelProps) => {
  const safeRequired = Math.max(required, 1);
  const clamped = Math.min(captured, safeRequired);

  return (
    <div
      className="samples"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeRequired}
      aria-valuetext={`${clamped} of ${safeRequired} ${unit}`}
    >
      <div className="samples__head">
        <span className="label">{unit}</span>
        <p className="samples__count">
          <strong>{clamped}</strong> / {safeRequired}
        </p>
      </div>

      <ul className="samples__dots" aria-hidden="true">
        {Array.from({ length: safeRequired }, (_, index) => (
          <li
            key={index}
            className={index < clamped ? "samples__dot samples__dot--filled" : "samples__dot"}
          />
        ))}
      </ul>
    </div>
  );
};
