import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

interface SearchPanelProps { query: string; loading: boolean; onQueryChange: (query: string) => void; onSubmit: (query: string) => void; }
interface SpeechResultEvent { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>; }
interface SpeechErrorEvent { error: string; }
interface SpeechRecognitionInstance {
  continuous: boolean; interimResults: boolean; lang: string; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onstart: (() => void) | null; onresult: ((event: SpeechResultEvent) => void) | null; onerror: ((event: SpeechErrorEvent) => void) | null; onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const SUGGESTIONS = ["Find an accessible study space open tonight", "Find somewhere with an automatic entrance", "Find a campus place with elevator access", "Avoid buildings with current accessibility impacts"];
const recognitionConstructor = (): SpeechRecognitionConstructor | undefined => {
  const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
};

export const SearchPanel = ({ query, loading, onQueryChange, onSubmit }: SearchPanelProps) => {
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("Click Speak, then say your search.");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const handleSubmit = (event: FormEvent) => { event.preventDefault(); onSubmit(query); };
  const toggleVoiceSearch = () => {
    if (listening && recognitionRef.current) { recognitionRef.current.stop(); return; }
    const SpeechRecognition = recognitionConstructor();
    if (!SpeechRecognition) { setVoiceMessage("Voice input is not supported in this browser. Use Chrome or Edge on localhost or HTTPS."); return; }
    recognitionRef.current?.abort();
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let transcript = "";
    recognition.onstart = () => { setListening(true); setVoiceMessage("Listening… speak your campus search now."); };
    recognition.onresult = (event) => {
      transcript = Array.from(event.results).slice(event.resultIndex).map((result) => result[0]?.transcript ?? "").join(" ").trim() || transcript;
      if (transcript) { onQueryChange(transcript); setVoiceMessage(`Heard: “${transcript}”`); }
    };
    recognition.onerror = (event) => {
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone permission was denied. Allow microphone access in the browser and try again."
        : event.error === "no-speech" ? "No speech was detected. Click Speak and try again."
          : `Voice input stopped (${event.error}). Click Speak to try again.`;
      setVoiceMessage(message); setListening(false);
    };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; if (!transcript) setVoiceMessage((current) => current.startsWith("Listening") ? "No speech was detected. Click Speak and try again." : current); };
    try { recognition.start(); } catch { setListening(false); recognitionRef.current = null; setVoiceMessage("Voice input could not start. Wait a moment and click Speak again."); }
  };

  return (
    <section aria-labelledby="search-heading">
      <h2 id="search-heading" className="sr-only">Search campus spaces</h2>
      <form onSubmit={handleSubmit}>
        <label className="search__label" htmlFor="campus-query">What are you looking for?</label>
        <div className="search__field">
          <input id="campus-query" className="search__input" type="text" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Find an accessible study space open tonight" aria-describedby="campus-query-hint voice-status" autoComplete="off" maxLength={500} disabled={loading} />
          <button id="campus-voice-toggle" type="button" className={`button search__voice${listening ? " search__voice--listening" : ""}`} onClick={toggleVoiceSearch} disabled={loading} aria-label={listening ? "Stop voice input" : "Enter search with your voice"} aria-pressed={listening}>
            <span className="search__mic" aria-hidden="true">●</span>{listening ? "Stop" : "Speak"}
          </button>
          <button id="campus-search-submit" type="submit" className="button button--primary search__submit" disabled={loading || query.trim().length === 0}>{loading ? "Searching" : "Search"}</button>
        </div>
        <p className={`search__voice-status${listening ? " search__voice-status--listening" : ""}`} id="voice-status" role="status" aria-live="polite">{voiceMessage}</p>
        <p className="search__hint" id="campus-query-hint">Ask in your own words. Mention accessibility needs and when you need the space. Before results: NEXT starts or stops the mic; SELECT searches what you said. With results: NEXT moves through them and SELECT opens one.</p>
      </form>
      <div className="suggestions"><span className="sr-only" id="suggestions-label">Example questions</span>{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" className="suggestions__chip" aria-describedby="suggestions-label" disabled={loading} onClick={() => { onQueryChange(suggestion); onSubmit(suggestion); }}>{suggestion}</button>)}</div>
    </section>
  );
};
