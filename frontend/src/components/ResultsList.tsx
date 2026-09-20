import { LocationCard } from "./LocationCard";
import type { CampusLocation } from "../types/contracts";

interface ResultsListProps {
  results: CampusLocation[];
  selectedIndex: number;
  onFocusResult: (index: number) => void;
  onSelectResult: (index: number) => void;
}

/**
 * Each result is a focusable list item in the same tab order as the search
 * controls, so gesture users can reach and open every result directly.
 */
export const ResultsList = ({
  results,
  selectedIndex,
  onFocusResult,
  onSelectResult
}: ResultsListProps) => {
  return (
    <ul
      className="results"
      aria-label="Campus results"
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
