import type {
  AgentResponse,
  ApiErrorResponse,
  CampusLocation,
  GestureCommand,
  Screen
} from "../types/contracts";
import type { CalibrationScores } from "../types/motionBridge";

export interface CalibrationState {
  neutralDone: boolean;
  nextDone: boolean;
  selectDone: boolean;
  /** Samples captured in the stage currently on screen. */
  captured: number;
  required: number;
  scores: CalibrationScores;
  error: string | null;
  phase: "IDLE" | "COLLECTING" | "WINDOW" | "WAITING_FOR_NEUTRAL";
}

export interface AppState {
  screen: Screen;
  selectedIndex: number;
  results: CampusLocation[];
  agentMessage: string;
  query: string;
  loading: boolean;
  error: ApiErrorResponse | null;
  /** True once a query has completed, so we can tell "no results" from "not asked yet". */
  hasSearched: boolean;
  calibration: CalibrationState;
  lastGesture: GestureCommand | null;
  gesturesEnabled: boolean;
  /** Short human-readable sentence mirrored into an aria-live region. */
  status: string;
}

const initialCalibration = (): CalibrationState => ({
  neutralDone: false,
  nextDone: false,
  selectDone: false,
  captured: 0,
  required: 5,
  scores: {},
  error: null,
  phase: "IDLE"
});

const initialState = (): AppState => ({
  screen: "LANDING",
  selectedIndex: 0,
  results: [],
  agentMessage: "",
  query: "",
  loading: false,
  error: null,
  hasSearched: false,
  calibration: initialCalibration(),
  lastGesture: null,
  gesturesEnabled: true,
  status: ""
});

/** How long gestures stay disabled after a screen change, in milliseconds. */
const TRANSITION_LOCK_MS = 500;

type Listener = (state: AppState) => void;

/**
 * Owns every piece of navigation state and is the single place a gesture turns
 * into an action. Deliberately framework-free: React subscribes to it via
 * useAppController, but nothing here depends on React.
 */
export class AppController {
  private state: AppState = initialState();
  private listeners = new Set<Listener>();
  private transitionTimer: number | null = null;

  /* ---------------------------------------------------------------- */
  /* Subscription                                                      */
  /* ---------------------------------------------------------------- */

  getState = (): AppState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  initialize = (): void => {
    this.state = initialState();
    this.setState({ status: "MotionBridge ready. Press Begin to start calibration." });
  };

  resetApp = (): void => {
    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    this.state = initialState();
    this.setState({ status: "Demo reset. Back at the start." });
  };

  /* ---------------------------------------------------------------- */
  /* Navigation                                                        */
  /* ---------------------------------------------------------------- */

  navigateTo = (screen: Screen): void => {
    if (screen === this.state.screen) return;

    // Ignore gestures briefly so a gesture that triggered the change cannot
    // immediately fire again on the screen it just opened.
    this.setState({
      screen,
      gesturesEnabled: false,
      calibration: { ...this.state.calibration, captured: 0, error: null },
      status: screenAnnouncement(screen)
    });

    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
    }
    this.transitionTimer = window.setTimeout(() => {
      this.transitionTimer = null;
      this.setState({ gesturesEnabled: true });
    }, TRANSITION_LOCK_MS);
  };

  /* ---------------------------------------------------------------- */
  /* Gesture handling                                                  */
  /* ---------------------------------------------------------------- */

  handleGesture = (command: GestureCommand): void => {
    this.setState({ lastGesture: command });

    if (command.command === "NEUTRAL") return;
    if (!this.canAcceptGesture()) return;

    if (command.command === "NEXT") {
      this.moveNext();
      return;
    }
    this.selectCurrent();
  };

  /**
   * Gestures drive navigation only on screens where that is meaningful.
   * During calibration the user is performing NEXT and SELECT in order to
   * *teach* them, so routing those to navigation would skip the flow.
   */
  private canAcceptGesture(): boolean {
    const { screen, gesturesEnabled, loading } = this.state;
    if (!gesturesEnabled || loading) return false;
    return screen === "CAMPUS_AGENT" || screen === "LOCATION_DETAILS" || screen === "READY";
  }

  moveNext = (): void => {
    const { screen, results, selectedIndex } = this.state;

    if (screen === "READY") return;

    if (screen === "CAMPUS_AGENT" || screen === "LOCATION_DETAILS") {
      if (this.focusNextInteractive(1)) return;
      if (screen === "LOCATION_DETAILS") return;
    }
    if (results.length === 0) return;

    const nextIndex = (selectedIndex + 1) % results.length;
    this.setState({
      selectedIndex: nextIndex,
      status: `Focused result ${nextIndex + 1} of ${results.length}: ${results[nextIndex].name}`
    });
  };

  movePrevious = (): void => {
    const { results, selectedIndex } = this.state;
    if (this.state.screen === "CAMPUS_AGENT" || this.state.screen === "LOCATION_DETAILS") {
      if (this.focusNextInteractive(-1)) return;
    }
    if (results.length === 0) return;

    const previousIndex = (selectedIndex - 1 + results.length) % results.length;
    this.setState({
      selectedIndex: previousIndex,
      status: `Focused result ${previousIndex + 1} of ${results.length}: ${results[previousIndex].name}`
    });
  };

  selectCurrent = (): void => {
    const { screen, results, selectedIndex } = this.state;

    if (screen === "READY") {
      this.navigateTo("CAMPUS_AGENT");
      return;
    }
    if (screen === "CAMPUS_AGENT" || screen === "LOCATION_DETAILS") {
      if (typeof document === "undefined") return;
      const activeElement = document.activeElement;
      const main = document.getElementById("main");
      if (activeElement instanceof HTMLElement && main?.contains(activeElement) && activeElement !== main) {
        if (activeElement instanceof HTMLButtonElement && activeElement.disabled) return;
        if (activeElement instanceof HTMLInputElement && activeElement.disabled) return;
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          activeElement.select();
          return;
        }
        activeElement.click();
        return;
      }
    }
    if (screen === "LOCATION_DETAILS") {
      this.closeDetails();
      return;
    }
    if (screen !== "CAMPUS_AGENT" || results.length === 0) return;

    this.navigateTo("LOCATION_DETAILS");
    this.setState({ status: `Opened details for ${results[selectedIndex].name}` });
  };

  setSelectedIndex = (index: number): void => {
    const { results } = this.state;
    if (index < 0 || index >= results.length) return;
    this.setState({
      selectedIndex: index,
      status: `Focused result ${index + 1} of ${results.length}: ${results[index].name}`
    });
  };

  openDetails = (index: number): void => {
    const { results } = this.state;
    if (index < 0 || index >= results.length) return;
    this.setState({ selectedIndex: index });
    this.navigateTo("LOCATION_DETAILS");
    this.setState({ status: `Opened details for ${results[index].name}` });
  };

  private focusNextInteractive(direction: 1 | -1): boolean {
    if (typeof document === "undefined") return false;
    const main = document.getElementById("main");
    if (!main) return false;

    const focusable = Array.from(main.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
    )).filter((element) => {
      if (element.getAttribute("aria-hidden") === "true" || element.closest('[aria-hidden="true"]')) return false;
      if (element.hidden) return false;
      return element.getClientRects().length > 0;
    });
    if (focusable.length === 0) return false;

    const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = activeIndex < 0
      ? direction > 0 ? 0 : focusable.length - 1
      : (activeIndex + direction + focusable.length) % focusable.length;
    focusable[nextIndex].focus();
    return true;
  }

  closeDetails = (): void => {
    if (this.state.screen !== "LOCATION_DETAILS") return;
    this.navigateTo("CAMPUS_AGENT");
    this.setState({ status: "Back to results" });
  };

  /* ---------------------------------------------------------------- */
  /* Calibration                                                       */
  /* ---------------------------------------------------------------- */

  updateSampleProgress = (captured: number, required: number, phase: CalibrationState["phase"] = "COLLECTING", issue?: string): void => {
    this.setState({
      calibration: { ...this.state.calibration, captured, required, phase, error: issue ?? null },
      status: `Captured ${captured} of ${required} samples`
    });
  };

  completeCalibrationStage = (stage: "NEUTRAL" | "NEXT" | "SELECT"): void => {
    const calibration = { ...this.state.calibration };
    if (stage === "NEUTRAL") calibration.neutralDone = true;
    if (stage === "NEXT") calibration.nextDone = true;
    if (stage === "SELECT") calibration.selectDone = true;
    this.setState({ calibration });
  };

  setCalibrationScores = (scores: CalibrationScores): void => {
    this.setState({ calibration: { ...this.state.calibration, scores } });
  };

  showCalibrationError = (message: string): void => {
    this.setState({
      calibration: { ...this.state.calibration, error: message },
      status: message
    });
  };

  /* ---------------------------------------------------------------- */
  /* Campus agent                                                      */
  /* ---------------------------------------------------------------- */

  setQuery = (query: string): void => {
    this.setState({ query });
  };

  startQuery = (): void => {
    this.setState({
      loading: true,
      error: null,
      status: "Asking the campus agent…"
    });
  };

  showAgentResponse = (response: AgentResponse): void => {
    this.setState({
      loading: false,
      error: null,
      hasSearched: true,
      results: response.results,
      agentMessage: response.message,
      selectedIndex: 0,
      status:
        response.results.length === 0
          ? "No matching campus spaces found"
          : `${response.results.length} results. Focused result 1: ${response.results[0].name}`
    });
  };

  showAgentError = (error: ApiErrorResponse): void => {
    this.setState({
      loading: false,
      error,
      hasSearched: true,
      results: [],
      agentMessage: "",
      status: `Search failed: ${error.error}`
    });
  };
}

const screenAnnouncement = (screen: Screen): string => {
  switch (screen) {
    case "LANDING":
      return "Welcome screen";
    case "NEUTRAL_CALIBRATION":
      return "Neutral calibration. Hold still and look at the camera.";
    case "NEXT_CALIBRATION":
      return "Teaching the NEXT movement.";
    case "SELECT_CALIBRATION":
      return "Teaching the SELECT movement.";
    case "READY":
      return "Calibration complete.";
    case "CAMPUS_AGENT":
      return "Campus search. Type a question or use your movements.";
    case "LOCATION_DETAILS":
      return "Location details.";
  }
};

export const appController = new AppController();
