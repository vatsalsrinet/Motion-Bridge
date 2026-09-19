import { useEffect, useState } from "react";
import type { GestureCommand } from "../types/contracts";

interface GestureOverlayProps {
  lastGesture: GestureCommand | null;
  /** False during a transition or while loading, when input is ignored. */
  gesturesEnabled: boolean;
  /** True when no real vision module is registered. */
  usingMock: boolean;
}

/** Milliseconds a command stays highlighted before dropping back to neutral. */
const ACTIVE_MS = 900;

/**
 * Live read-out of what the tracker last saw. Subtle in normal use; add
 * ?demo=1 to the URL to enlarge it for an audience.
 */
export const GestureOverlay = ({
  lastGesture,
  gesturesEnabled,
  usingMock
}: GestureOverlayProps) => {
  const [active, setActive] = useState(false);
  const demoMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1";

  useEffect(() => {
    if (!lastGesture || lastGesture.command === "NEUTRAL") {
      setActive(false);
      return;
    }
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), ACTIVE_MS);
    return () => window.clearTimeout(timer);
  }, [lastGesture]);

  const cooldown = !gesturesEnabled;
  const command = !lastGesture || lastGesture.command === "NEUTRAL" ? "Neutral" : lastGesture.command;
  // Confidence is optional in practice: the UI must not break if it is missing.
  const confidence =
    typeof lastGesture?.confidence === "number" && Number.isFinite(lastGesture.confidence)
      ? Math.min(Math.max(lastGesture.confidence, 0), 1)
      : null;

  const classes = [
    "overlay",
    active && !cooldown ? "overlay--active" : "",
    cooldown ? "overlay--cooldown" : "",
    demoMode ? "overlay--demo" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={classes} aria-label="Movement tracker status">
      <p className="overlay__label">{cooldown ? "Cooldown" : "Last movement"}</p>
      <p className="overlay__command">{cooldown ? "Not listening" : command}</p>

      {confidence !== null && (
        <>
          <div
            className="overlay__meter"
            role="meter"
            aria-label="Recognition confidence"
            aria-valuenow={Math.round(confidence * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="overlay__fill" style={{ width: `${confidence * 100}%` }} />
          </div>
          <p className="overlay__confidence">{Math.round(confidence * 100)}% confidence</p>
        </>
      )}

      {usingMock && <p className="overlay__source">Simulated tracker — vision module not connected</p>}
    </aside>
  );
};
