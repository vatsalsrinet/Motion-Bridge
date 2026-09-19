interface CalibrationPanelProps {
  captured: number;
  required: number;
  /** Shown as the progress caption, e.g. "samples captured". */
  unit: string;
}

/**
 * Sample progress. Shows the ratio as text and as a row of dots, and exposes
 * it as a progressbar so the count is available to assistive tech too.
 */
export const CalibrationPanel = ({ captured, required, unit }: CalibrationPanelProps) => {
  const safeRequired = Math.max(required, 1);
  const clamped = Math.min(captured, safeRequired);

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeRequired}
      aria-valuetext={`${clamped} of ${safeRequired} ${unit}`}
    >
      <p className="samples__count">
        {clamped} <span>/ {safeRequired}</span>
      </p>
      <p className="search__hint">{unit}</p>

      <ul className="samples" aria-hidden="true">
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
