import { useEffect, useRef } from "react";
import { AccessibilityBadges } from "./AccessibilityBadges";
import { ImpactWarning } from "./ImpactWarning";
import type { CampusLocation } from "../types/contracts";

interface LocationCardProps {
  location: CampusLocation;
  index: number;
  total: number;
  focused: boolean;
  onFocus: () => void;
  onSelect: () => void;
}

/**
 * One result. Rendered as an option in a listbox: the list owns focus and
 * moves aria-activedescendant, which is what lets a single gesture change the
 * selection without ever moving DOM focus.
 */
export const LocationCard = ({
  location,
  index,
  total,
  focused,
  onFocus,
  onSelect
}: LocationCardProps) => {
  const ref = useRef<HTMLLIElement>(null);
  const hours =
    location.openTime && location.closeTime ? `${location.openTime}–${location.closeTime}` : null;

  // Keep the focused card on screen as gestures walk down a long list.
  useEffect(() => {
    if (focused) {
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focused]);

  return (
    <li
      ref={ref}
      id={`result-${location.id}`}
      role="option"
      aria-selected={focused}
      className={focused ? "card card--focused" : "card"}
      onClick={() => {
        onFocus();
        onSelect();
      }}
    >
      <div className="card__head">
        <span className="card__index">
          {String(index + 1).padStart(2, "0")}
          <span className="sr-only"> of {total}</span>
        </span>
        <h3 className="card__name">{location.name}</h3>
        {focused && <span className="card__focus-flag">Focused</span>}
        <span className="card__meta">
          {location.category}
          {hours && ` · ${hours}`}
        </span>
      </div>

      <AccessibilityBadges info={location.accessibility} />

      {location.address && <p className="card__address">{location.address}</p>}
      {location.operatingHours && (
        <div className="card__hours-block">
          <dl className="card__hours">
            <div><dt>Weekdays</dt><dd>{location.operatingHours.weekdays}</dd></div>
            <div><dt>Weekends</dt><dd>{location.operatingHours.weekends}</dd></div>
          </dl>
          <p className={`hours-status hours-status--${location.operatingHours.status}`}>
            {location.operatingHours.status === "published" ? "Published hours" : "Typical hours · verify"}
          </p>
        </div>
      )}
      {location.matchReason && <p className="card__reason">{location.matchReason}</p>}

      {location.activeImpacts.map((impact, impactIndex) => (
        <ImpactWarning key={impact.id ?? `${impact.type}-${impactIndex}`} impact={impact} />
      ))}
    </li>
  );
};
