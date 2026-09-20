import { useCallback, useState } from "react";
import { CameraPanel } from "./components/CameraPanel";
import { GestureOverlay } from "./components/GestureOverlay";
import { LocationDetails } from "./components/LocationDetails";
import { CalibrationPage } from "./pages/CalibrationPage";
import { CampusAgentPage } from "./pages/CampusAgentPage";
import { LandingPage } from "./pages/LandingPage";
import { ReadyPage } from "./pages/ReadyPage";
import { appController, useAppState } from "./hooks/useAppController";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { useCampusAgent } from "./hooks/useCampusAgent";
import { useKeyboardFallback } from "./hooks/useKeyboardFallback";
import { useMotionBridge } from "./hooks/useMotionBridge";
import type { Screen } from "./types/contracts";
import "./styles/global.css";
import "./styles/components.css";

const STEP_LABEL: Record<Screen, string> = {
  LANDING: "Welcome",
  NEUTRAL_CALIBRATION: "Calibration 1 of 3",
  NEXT_CALIBRATION: "Calibration 2 of 3",
  SELECT_CALIBRATION: "Calibration 3 of 3",
  READY: "Ready",
  CAMPUS_AGENT: "Campus search",
  LOCATION_DETAILS: "Location details"
};

export const App = () => {
  const state = useAppState();
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const { submitQuery, mocked } = useCampusAgent();
  // No point probing the API when the UI is deliberately running on mocks.
  const health = useBackendHealth(!mocked);
  const motion = useMotionBridge(videoElement);
  useKeyboardFallback();

  const onVideoReady = useCallback((element: HTMLVideoElement | null) => {
    setVideoElement(element);
  }, []);

  const calibrationScreen = state.screen === "NEUTRAL_CALIBRATION" || state.screen === "NEXT_CALIBRATION" || state.screen === "SELECT_CALIBRATION";

  const renderScreen = () => {
    switch (state.screen) {
      case "LANDING":
        return <LandingPage onBegin={() => appController.navigateTo("NEUTRAL_CALIBRATION")} />;

      case "NEUTRAL_CALIBRATION":
        return (
          <CalibrationPage
            stage="NEUTRAL"
            captured={state.calibration.captured}
            required={state.calibration.required}
            phase={state.calibration.phase}
            error={state.calibration.error}
            complete={state.calibration.neutralDone}
            ready={motion.started}
            onStart={motion.beginNeutralCalibration}
            onContinue={() => appController.navigateTo("NEXT_CALIBRATION")}
            onSkip={() => appController.navigateTo("NEXT_CALIBRATION")}
          />
        );

      case "NEXT_CALIBRATION":
        return (
          <CalibrationPage
            stage="NEXT"
            captured={state.calibration.captured}
            required={state.calibration.required}
            phase={state.calibration.phase}
            error={state.calibration.error}
            complete={state.calibration.nextDone}
            ready={motion.started}
            onStart={() => motion.beginGestureCalibration("NEXT")}
            onContinue={() => appController.navigateTo("SELECT_CALIBRATION")}
            onSkip={() => appController.navigateTo("SELECT_CALIBRATION")}
          />
        );

      case "SELECT_CALIBRATION":
        return (
          <CalibrationPage
            stage="SELECT"
            captured={state.calibration.captured}
            required={state.calibration.required}
            phase={state.calibration.phase}
            error={state.calibration.error}
            complete={state.calibration.selectDone}
            ready={motion.started}
            onStart={() => motion.beginGestureCalibration("SELECT")}
            onContinue={() => {
              motion.readScores();
              appController.navigateTo("READY");
            }}
            onSkip={() => appController.navigateTo("READY")}
          />
        );

      case "READY":
        return (
          <ReadyPage
            calibration={state.calibration}
            onContinue={() => appController.navigateTo("CAMPUS_AGENT")}
            onRecalibrate={() => appController.navigateTo("NEUTRAL_CALIBRATION")}
          />
        );

      case "CAMPUS_AGENT":
        return (
          <CampusAgentPage
            state={state}
            dataSource={health.dataSource}
            mocked={mocked}
            onQueryChange={appController.setQuery}
            onSubmit={submitQuery}
            onFocusResult={appController.setSelectedIndex}
            onSelectResult={appController.openDetails}
          />
        );

      case "LOCATION_DETAILS": {
        const location = state.results[state.selectedIndex];
        if (!location) {
          appController.closeDetails();
          return null;
        }
        return (
          <LocationDetails
            location={location}
            position={state.selectedIndex + 1}
            total={state.results.length}
            onBack={appController.closeDetails}
          />
        );
      }
    }
  };

  return (
    <div className={calibrationScreen ? "app app--calibration" : "app"}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="header">
        <p className="header__brand">
          <span className="header__mark" aria-hidden="true" />
          MotionBridge
        </p>
        <p className="header__step">{STEP_LABEL[state.screen]}</p>
      </header>

      <div className={calibrationScreen ? "tracker-dock" : "tracker-dock tracker-dock--parked"} aria-hidden={!calibrationScreen}>
        <CameraPanel onVideoReady={onVideoReady} onSkip={() => appController.navigateTo("READY")} />
        {calibrationScreen && <p className="camera__note">Camera frames are sent only to the local MotionBridge vision service.</p>}
      </div>

      <main className={calibrationScreen ? "app__main app__main--calibration" : "app__main"} id="main" tabIndex={-1}>
        {renderScreen()}
      </main>

      {/* Single polite live region: every meaningful state change is announced once. */}
      <p className="sr-only" role="status" aria-live="polite">
        {state.status}
      </p>

      <GestureOverlay
        lastGesture={state.lastGesture}
        gesturesEnabled={state.gesturesEnabled}
        usingMock={motion.usingMock}
      />

      <div className="devbar">
        <span className="devbar__label">Demo controls</span>
        <button
          type="button"
          className="devbar__button"
          onClick={() => appController.handleGesture({ command: "NEXT", confidence: 0.94 })}
        >
          Fire NEXT
        </button>
        <button
          type="button"
          className="devbar__button"
          onClick={() => appController.handleGesture({ command: "SELECT", confidence: 0.91 })}
        >
          Fire SELECT
        </button>
        <button
          type="button"
          className="devbar__button"
          onClick={() => appController.handleGesture({ command: "NEUTRAL", confidence: 0.99 })}
        >
          Fire NEUTRAL
        </button>
        <button type="button" className="devbar__button" onClick={appController.resetApp}>
          Reset demo
        </button>
        <span className="devbar__spacer" />
        <span className="devbar__label">
          {mocked
            ? "Agent: mocked"
            : health.checked
              ? health.reachable
                ? `API: up · Data: ${health.dataSource === "live" ? "Databricks" : "seed snapshot"}`
                : "API: unreachable"
              : "API: checking…"}{" "}
          · {motion.usingMock ? "Tracker: simulated" : "Tracker: live"}
        </span>
      </div>
    </div>
  );
};
