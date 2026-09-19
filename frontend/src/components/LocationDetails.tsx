import { useEffect, useRef } from "react";
import { AccessibilityBadges } from "./AccessibilityBadges";
import { ImpactWarning } from "./ImpactWarning";
import type { CampusLocation } from "../types/contracts";

interface LocationDetailsProps {
  location: CampusLocation;
  position: number;
  total: number;
  onBack: () => void;
}

/** Full record for the selected location, opened by SELECT or by click. */
export const LocationDetails = ({ location, position, total, onBack }: LocationDetailsProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the heading so screen-reader and keyboard users land in the
  // new content instead of at the top of the document.
  useEffect(() => {
    headingRef.current?.focus();
  }, [location.id]);

  const hours =
    location.openTime && location.closeTime ? `${location.openTime} – ${location.closeTime}` : "Not published";

  return (
    <article className="stack">
      <div className="details__back">
        <button type="button" className="button button--ghost" onClick={onBack}>
          ← Back to results
          <span className="sr-only"> (or press Escape)</span>
        </button>
      </div>

      <header>
        <p className="eyebrow">
          Result {position} of {total}
        </p>
        <h2 className="details__title" tabIndex={-1} ref={headingRef}>
          {location.name}
        </h2>
        <p className="details__category">{location.category}</p>
      </header>

      {location.activeImpacts.length > 0 && (
        <section className="details__section" aria-labelledby="impacts-heading">
          <h3 id="impacts-heading">
            Active accessibility {location.activeImpacts.length === 1 ? "impact" : "impacts"}
          </h3>
          {location.activeImpacts.map((impact, index) => (
            <ImpactWarning key={impact.id ?? `${impact.type}-${index}`} impact={impact} />
          ))}
        </section>
      )}

      <section className="details__section panel" aria-labelledby="access-heading">
        <h3 id="access-heading">Accessibility</h3>
        <AccessibilityBadges info={location.accessibility} showNotes />
      </section>

      <section className="details__section" aria-labelledby="facts-heading">
        <h3 id="facts-heading">Details</h3>
        <dl className="details__facts">
          <div className="details__fact">
            <dt>Hours</dt>
            <dd>{hours}</dd>
          </div>
          <div className="details__fact">
            <dt>Category</dt>
            <dd>{location.category}</dd>
          </div>
          {typeof location.latitude === "number" && typeof location.longitude === "number" && (
            <div className="details__fact">
              <dt>Coordinates</dt>
              <dd>
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <p className="search__hint">
        Perform SELECT, or press Escape, to go back. NEXT moves to the following result.
      </p>
    </article>
  );
};
