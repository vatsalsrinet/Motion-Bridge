import type { AccessibilityInfo } from "../types/contracts";

interface AccessibilityBadgesProps {
  info: AccessibilityInfo;
  showNotes?: boolean;
}

const FEATURES: { key: keyof AccessibilityInfo; label: string }[] = [
  { key: "accessibleEntrance", label: "Accessible entrance" },
  { key: "automaticDoor", label: "Automatic door" },
  { key: "elevatorAvailable", label: "Elevator" },
  { key: "accessibleRoute", label: "Accessible route" }
];

/**
 * Each feature states its answer three ways — icon, word and border — so the
 * information never depends on colour alone.
 */
export const AccessibilityBadges = ({ info, showNotes = false }: AccessibilityBadgesProps) => (
  <>
    <ul className="badges">
      {FEATURES.map(({ key, label }) => {
        const present = Boolean(info[key]);
        return (
          <li key={key} className={present ? "badge badge--yes" : "badge badge--no"}>
            <span className="badge__icon" aria-hidden="true">
              {present ? "✓" : "✕"}
            </span>
            <span>
              {label}: {present ? "yes" : "no"}
            </span>
          </li>
        );
      })}
    </ul>

    {showNotes && info.notes && <p className="notes">{info.notes}</p>}
  </>
);
