import { useEffect } from "react";
import { appController } from "../app/AppController";

/**
 * Keyboard equivalents for every gesture, so the whole product is usable with
 * no camera at all — the fallback the brief requires, and how the demo is
 * driven if the vision module misbehaves in front of judges.
 *
 *   ArrowDown / ArrowRight  → NEXT
 *   ArrowUp / ArrowLeft     → previous
 *   Enter / Space           → SELECT
 *   Escape                  → back
 */
const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
};

export const useKeyboardFallback = (): void => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Never steal keys from a text field or from a focused button, where the
      // browser's own Enter/Space handling is what the user expects.
      if (isTypingTarget(event.target)) return;

      const state = appController.getState();
      const onResults = state.screen === "CAMPUS_AGENT" || state.screen === "LOCATION_DETAILS";

      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          if (!onResults) return;
          event.preventDefault();
          appController.moveNext();
          return;

        case "ArrowUp":
        case "ArrowLeft":
          if (!onResults) return;
          event.preventDefault();
          appController.movePrevious();
          return;

        case "Enter":
        case " ":
          // Let a focused button handle its own activation.
          if (event.target instanceof HTMLButtonElement) return;
          if (!onResults) return;
          event.preventDefault();
          appController.selectCurrent();
          return;

        case "Escape":
          if (state.screen === "LOCATION_DETAILS") {
            event.preventDefault();
            appController.closeDetails();
          }
          return;

        default:
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
