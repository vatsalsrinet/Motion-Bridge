import type { AccessibilityInfo } from "../types/contracts";

interface AccessibilityBadgesProps {
  info: AccessibilityInfo;
  showNotes?: boolean;
}

const FEATURES: { key: keyof AccessibilityInfo; label: string; absent: string }[] = [
  { key: "accessibleEntrance", label: "Accessible entrance", absent: "No accessible entrance" },
  { key: "automaticDoor", label: "Automatic door", absent: "No automatic door" },
  { key: "elevatorAvailable", label: "Elevator", absent: "No elevator" },
  { key: "accessibleRoute", label: "Accessible route", absent: "No accessible route" }
];

/**
 * Present and absent features differ by glyph, by wording and by border
 * style, so the distinction survives with no colour perception at all.
 */
export const AccessibilityBadges = ({ info, showNotes = false }: AccessibilityBadgesProps) => (
  <>
    <ul className="badges">
      {FEATURES.map(({ key, label, absent }) => {
        const present = Boolean(info[key]);
        return (
          <li key={key} className={present ? "badge" : "badge badge--no"}>
            <span aria-hidden="true">{present ? "✓" : "✗"}</span>
            <span>{present ? label : absent}</span>
          </li>
        );
      })}
    </ul>

    {showNotes && info.notes && <p className="notes">{info.notes}</p>}
  </>
);
