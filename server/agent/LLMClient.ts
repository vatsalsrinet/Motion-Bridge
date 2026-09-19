import { SearchConstraints } from "./SearchConstraints";

export interface LLMClient {
  extractConstraints(query: string): Promise<SearchConstraints>;
  generateExplanation(results: unknown[]): Promise<string>;
}

const hasAny = (query: string, terms: string[]): boolean =>
  terms.some((term) => query.includes(term));

export class RuleBasedLLMClient implements LLMClient {
  async extractConstraints(query: string): Promise<SearchConstraints> {
    const normalizedQuery = query.toLowerCase();
    const constraints: SearchConstraints = {};

    const category = ["study", "academic", "recreation", "dining", "hospital"]
      .find((candidate) => normalizedQuery.includes(candidate));
    if (category) constraints.category = category;
    if (!category && hasAny(normalizedQuery, ["library", "quiet", "work"])) {
      constraints.category = "study";
    }
    if (hasAny(normalizedQuery, ["accessible", "disability", "wheelchair", "mobility"])) {
      constraints.needsAccessibleEntrance = true;
    }
    if (hasAny(normalizedQuery, ["elevator", "lift"])) {
      constraints.needsElevator = true;
    }
    if (hasAny(normalizedQuery, ["impact", "construction", "closed", "avoid"])) {
      constraints.avoidActiveImpacts = true;
    }
    if (hasAny(normalizedQuery, ["automatic", "automatic entrance", "automatic door"])) {
      constraints.needsAccessibleEntrance = true;
      constraints.needsAutomaticDoor = true;
    }

    const timeMatch = normalizedQuery.match(/(?:after|open at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hour = Number(timeMatch[1]);
      const minutes = timeMatch[2] ?? "00";
      const meridiem = timeMatch[3];
      if (meridiem === "pm" && hour < 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;
      constraints.openAfter = `${String(hour).padStart(2, "0")}:${minutes}`;
    } else if (normalizedQuery.includes("tonight")) {
      constraints.openAfter = "18:00";
    }

    return constraints;
  }

  async generateExplanation(results: unknown[]): Promise<string> {
    if (results.length === 0) return "I could not find a matching campus location.";
    return `I found ${results.length} campus option${results.length === 1 ? "" : "s"} matching your accessibility and availability needs.`;
  }
}
