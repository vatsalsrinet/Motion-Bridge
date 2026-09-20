import { ResultsList } from "../components/ResultsList";
import { SearchPanel } from "../components/SearchPanel";
import type { AppState } from "../app/AppController";
import type { DataSource } from "../hooks/useBackendHealth";

interface CampusAgentPageProps {
  state: AppState;
  /** Where results came from, so seed data is never shown as live. */
  dataSource: DataSource;
  mocked: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: (query: string) => void;
  onFocusResult: (index: number) => void;
  onSelectResult: (index: number) => void;
}

export const CampusAgentPage = ({
  state,
  dataSource,
  mocked,
  onQueryChange,
  onSubmit,
  onFocusResult,
  onSelectResult
}: CampusAgentPageProps) => {
  const { query, loading, error, results, agentMessage, hasSearched, selectedIndex } = state;

  // Person 4's brief is explicit: do not misrepresent fallback data as live.
  const provenance = mocked
    ? "Demo mode · canned sample data, not a live campus query"
    : dataSource === "seed"
      ? "Official VT Facilities GIS snapshot · live Databricks connection unavailable"
      : null;

  return (
    <div className="stack">
      <header>
        <p className="eyebrow">Campus search</p>
        <h2 className="display" style={{ fontSize: "var(--text-2xl)" }}>
          Find an <em>accessible space.</em>
        </h2>
      </header>

      <SearchPanel
        query={query}
        loading={loading}
        onQueryChange={onQueryChange}
        onSubmit={onSubmit}
      />

      {loading && (
        <div className="loading">
          <span className="loading__spinner" aria-hidden="true" />
          <span>Checking campus data</span>
        </div>
      )}

      {!loading && error && (
        <div className="notice notice--error" role="alert">
          <p className="notice__title">
            <span className="notice__bang" aria-hidden="true">
              !
            </span>
            Search failed
          </p>
          <p className="notice__body">{error.error}</p>
          <p className="notice__code">
            {error.code} {error.retryable ? "· retryable" : ""}
          </p>
          {error.retryable && (
            <button type="button" className="button button--primary" onClick={() => onSubmit(query)}>
              Try again
            </button>
          )}
        </div>
      )}

      {!loading && !error && hasSearched && results.length === 0 && (
        <div className="notice">
          <p className="notice__title">Nothing matched</p>
          <p className="notice__body">
            {agentMessage ||
              "No campus space matched every constraint. Try relaxing one of them."}
          </p>
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <>
          {agentMessage && (
            <div className="agent-message">
              <p className="agent-message__label">Campus agent</p>
              <p className="agent-message__body">{agentMessage}</p>
            </div>
          )}

          <div>
            {provenance && <p className="provenance">{provenance}</p>}

            <div className="results__head">
              <span className="label">
                {results.length} best {results.length === 1 ? "match" : "matches"}
              </span>
              <span className="label">Next moves focus &#183; Select opens</span>
            </div>

            <ResultsList
              results={results}
              selectedIndex={selectedIndex}
              onFocusResult={onFocusResult}
              onSelectResult={onSelectResult}
            />
          </div>
        </>
      )}
    </div>
  );
};
