import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppController } from "./AppController";

describe("search page gesture controls", () => {
  let controller: AppController;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <button id="campus-voice-toggle">Speak</button>
      <button id="campus-search-submit">Search</button>
    `;
    controller = new AppController();
    controller.navigateTo("CAMPUS_AGENT");
    vi.advanceTimersByTime(500);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("uses NEXT to toggle voice input before results exist", () => {
    const click = vi.fn();
    document.getElementById("campus-voice-toggle")?.addEventListener("click", click);

    controller.handleGesture({ command: "NEXT", confidence: 0.9 });

    expect(click).toHaveBeenCalledOnce();
  });

  it("uses SELECT to start voice input with an empty query and submit a spoken query", () => {
    const voiceClick = vi.fn();
    const searchClick = vi.fn();
    document.getElementById("campus-voice-toggle")?.addEventListener("click", voiceClick);
    document.getElementById("campus-search-submit")?.addEventListener("click", searchClick);

    controller.handleGesture({ command: "SELECT", confidence: 0.9 });
    expect(voiceClick).toHaveBeenCalledOnce();

    controller.setQuery("Find an accessible study space");
    controller.handleGesture({ command: "SELECT", confidence: 0.9 });
    expect(searchClick).toHaveBeenCalledOnce();
  });
});
