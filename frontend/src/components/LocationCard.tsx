import { useEffect, useRef } from "react";
import { AccessibilityBadges } from "./AccessibilityBadges";
import type { CampusLocation } from "../types/contracts";

interface LocationCardProps {
  location: CampusLocation;
  index: number;
  total: number;
  focused: boolean;
  onFocus: () => void;
  onSelect: () => void;
}

const formatHours = (location: CampusLocation): string | null => {
  if (!location.openTime || !location.closeTime) return null;
  return `${location.openTime} – ${location.closeTime}`;
};

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
  const hours = formatHours(location);
  const impactCount = location.activeImpacts.length;

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
          {index + 1}
          <span aria-hidden="true">/{total}</span>
          <span className="sr-only"> of {total}</span>
        </span>
        <h3 className="card__name">{location.name}</h3>
        {focused && <span className="card__focus-flag">Focused</span>}
      </div>

      <div className="card__meta">
        <span>{location.category}</span>
        {hours && <span>Open {hours}</span>}
        {impactCount > 0 && (
          <span>
            {impactCount} active {impactCount === 1 ? "impact" : "impacts"}
          </span>
        )}
      </div>

      <AccessibilityBadges info={location.accessibility} />
    </li>
  );
};
