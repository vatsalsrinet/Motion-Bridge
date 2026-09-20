import { LocationCard } from "./LocationCard";
import type { CampusLocation } from "../types/contracts";

interface ResultsListProps {
  results: CampusLocation[];
  selectedIndex: number;
  onFocusResult: (index: number) => void;
  onSelectResult: (index: number) => void;
}

/**
 * Listbox with a single tab stop. Arrow keys and gestures both move
 * aria-activedescendant rather than DOM focus, which keeps the interaction
 * identical whether it came from the keyboard or the camera.
 */
export const ResultsList = ({
  results,
  selectedIndex,
  onFocusResult,
  onSelectResult
}: ResultsListProps) => {
  const active = results[selectedIndex];

  return (
    <ul
      className="results"
      role="listbox"
      tabIndex={0}
      aria-label="Campus results"
      aria-activedescendant={active ? `result-${active.id}` : undefined}
    >
      {results.map((location, index) => (
        <LocationCard
          key={location.id}
          location={location}
          index={index}
          total={results.length}
          focused={index === selectedIndex}
          onFocus={() => onFocusResult(index)}
          onSelect={() => onSelectResult(index)}
        />
      ))}
    </ul>
  );
};
