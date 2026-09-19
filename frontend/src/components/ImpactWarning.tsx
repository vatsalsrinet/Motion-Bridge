import type { CampusImpact } from "../types/contracts";

interface ImpactWarningProps {
  impact: CampusImpact;
}

/**
 * Real impact rows carry a terse category in `type` — "accessibility",
 * "construction" — rather than a headline. Presenting that raw reads badly, so
 * generic categories get the word "impact" appended. The description is never
 * rewritten: it is campus data and shown as authored.
 */
const GENERIC_TYPES = new Set(["accessibility", "access", "general", "other", "unknown"]);

const formatImpactType = (type: string): string => {
  const trimmed = type.trim();
  if (trimmed.length === 0) return "Active impact";

  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return GENERIC_TYPES.has(trimmed.toLowerCase()) ? `${capitalized} impact` : capitalized;
};

/** An active accessibility impact. Marked up as a warning, not decoration. */
export const ImpactWarning = ({ impact }: ImpactWarningProps) => (
  <div className="impact">
    <span className="impact__icon" aria-hidden="true">
      !
    </span>
    <div>
      <p className="impact__type">
        <span className="sr-only">Warning: </span>
        {formatImpactType(impact.type)}
      </p>
      <p className="impact__description">{impact.description}</p>
    </div>
  </div>
);
