import type { FormEvent } from "react";

interface SearchPanelProps {
  query: string;
  loading: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: (query: string) => void;
}

/** Queries the agent handles well — doubles as a demo script. */
const SUGGESTIONS = [
  "Find an accessible study space open tonight",
  "Find somewhere with an automatic entrance",
  "Find a campus place with elevator access",
  "Avoid buildings with current accessibility impacts"
];

export const SearchPanel = ({ query, loading, onQueryChange, onSubmit }: SearchPanelProps) => {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(query);
  };

  return (
    <section aria-labelledby="search-heading">
      <h2 id="search-heading" className="sr-only">
        Search campus spaces
      </h2>

      <form onSubmit={handleSubmit}>
        <label className="search__label" htmlFor="campus-query">
          What are you looking for?
        </label>

        <div className="search__field">
          <input
            id="campus-query"
            className="search__input"
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Find an accessible study space open tonight"
            aria-describedby="campus-query-hint"
            autoComplete="off"
            maxLength={500}
            disabled={loading}
          />
          <button
            type="submit"
            className="button button--primary search__submit"
            disabled={loading || query.trim().length === 0}
          >
            {loading ? "Searching" : "Search"}
          </button>
        </div>

        <p className="search__hint" id="campus-query-hint">
          Ask in your own words. Mention accessibility needs and when you need the space.
        </p>
      </form>

      <div className="suggestions">
        <span className="sr-only" id="suggestions-label">
          Example questions
        </span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="suggestions__chip"
            aria-describedby="suggestions-label"
            disabled={loading}
            onClick={() => {
              onQueryChange(suggestion);
              onSubmit(suggestion);
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
};
