import { useEffect, useRef } from "react";
import { ImpactWarning } from "./ImpactWarning";
import type { AccessibilityInfo, CampusLocation } from "../types/contracts";

interface LocationDetailsProps {
  location: CampusLocation;
  position: number;
  total: number;
  onBack: () => void;
}

const FEATURES: { key: keyof AccessibilityInfo; label: string }[] = [
  { key: "accessibleEntrance", label: "Accessible entrance" },
  { key: "automaticDoor", label: "Automatic door" },
  { key: "elevatorAvailable", label: "Elevator available" },
  { key: "accessibleRoute", label: "Accessible route" }
];

/** Full record for the selected location, opened by SELECT or by click. */
export const LocationDetails = ({ location, position, total, onBack }: LocationDetailsProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the heading so screen-reader and keyboard users land in the
  // new content instead of at the top of the document.
  useEffect(() => {
    headingRef.current?.focus();
  }, [location.id]);

  const hours = location.operatingHours;

  return (
    <article>
      <button type="button" className="details__back" onClick={onBack}>
        <span aria-hidden="true">&#8592;</span> Back to results &#183; Esc
      </button>

      <div className="details">
        <div>
          <p className="eyebrow">
            Result {position} of {total}
          </p>
          <h2 className="details__title" tabIndex={-1} ref={headingRef}>
            {location.name}
          </h2>
          <p className="details__category">{location.category}</p>

          <dl className="facts">
            {location.address && (
              <div className="facts__row">
                <dt>Address</dt>
                <dd>{location.address}</dd>
              </div>
            )}
            <div className="facts__row">
              <dt>Weekdays</dt>
              <dd className="mono">{hours?.weekdays ?? "Check with building"}</dd>
            </div>
            <div className="facts__row">
              <dt>Weekends</dt>
              <dd className="mono">{hours?.weekends ?? "Check with building"}</dd>
            </div>
            <div className="facts__row">
              <dt>Category</dt>
              <dd>{location.category}</dd>
            </div>
            {typeof location.latitude === "number" && typeof location.longitude === "number" && (
              <div className="facts__row">
                <dt>Coordinates</dt>
                <dd className="mono">
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </dd>
              </div>
            )}
          </dl>
          {hours && (
            <p className="hours-note">
              <strong>{hours.status === "published" ? "Published schedule." : "Typical schedule."}</strong>{" "}
              {hours.note}
            </p>
          )}
        </div>

        <div>
          {location.activeImpacts.length > 0 && (
            <section aria-labelledby="impacts-heading">
              <h3 id="impacts-heading" className="sr-only">
                Active accessibility impacts
              </h3>
              {location.activeImpacts.map((impact, index) => (
                <ImpactWarning key={impact.id ?? `${impact.type}-${index}`} impact={impact} />
              ))}
            </section>
          )}

          <section aria-labelledby="access-heading" style={{ marginTop: "var(--space-6)" }}>
            <h3 id="access-heading" className="label">
              Accessibility
            </h3>

            <div className="access">
              {FEATURES.map(({ key, label }) => {
                const present = Boolean(location.accessibility[key]);
                return (
                  <div
                    key={key}
                    className={present ? "access__row" : "access__row access__row--no"}
                  >
                    <span className="access__icon" aria-hidden="true">
                      {present ? "✓" : "✗"}
                    </span>
                    <span className="access__name">{label}</span>
                    <span className="access__value">{present ? "Yes" : "No"}</span>
                  </div>
                );
              })}
            </div>

            {location.accessibility.notes && <p className="notes">{location.accessibility.notes}</p>}
          </section>
        </div>
      </div>

      <p className="camera__note" style={{ marginTop: "var(--space-6)" }}>
        Select goes back &#183; Next moves to the following result.
      </p>
    </article>
  );
};
