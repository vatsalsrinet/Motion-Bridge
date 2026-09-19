import { startMotionBridge, type MotionBridgeController, type GestureCommand } from "../vision";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="shell">
    <header class="masthead">
      <div class="eyebrow"><span class="status-dot"></span> MOTIONBRIDGE / VISION LAB</div>
      <h1>Teach the camera<br /><em>your language.</em></h1>
      <p class="lede">A small calibration bench for personalized head gestures. Keep your face centered and hold each movement until the sample meter completes.</p>
      <div class="run-state" id="run-state"><span>●</span> BOOTING SENSOR ARRAY</div>
    </header>

    <section class="workspace">
      <div class="preview-card panel">
        <div class="panel-label"><span>01 / OPTICAL FEED</span><span id="face-state">WAITING</span></div>
        <div class="video-wrap"><video id="camera" autoplay muted playsinline></video><div class="scanline"></div><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div></div>
        <div class="detection-card"><div><span class="micro-label">CURRENT DETECTION</span><strong id="prediction">UNKNOWN</strong></div><div class="confidence"><span class="micro-label">CONFIDENCE</span><strong id="confidence">0%</strong></div></div>
        <div class="class-scores"><div class="score-row" data-score="NEUTRAL"><span>NEUTRAL</span><i><b id="score-neutral"></b></i><strong id="score-neutral-value">0%</strong></div><div class="score-row" data-score="NEXT"><span>NEXT</span><i><b id="score-next"></b></i><strong id="score-next-value">0%</strong></div><div class="score-row" data-score="SELECT"><span>SELECT</span><i><b id="score-select"></b></i><strong id="score-select-value">0%</strong></div></div>
      </div>

      <div class="calibration-card panel">
        <div class="panel-label"><span>02 / PERSONAL PROFILE</span><span id="ready-badge" class="badge">NOT READY</span></div>
        <div class="calibration-status"><strong id="calibration-title">CALIBRATION IDLE</strong><span id="calibration-instruction">Choose a calibration step to begin learning.</span><div id="sample-dots" class="sample-dots"></div></div>
        <div class="meters">
          <div class="meter" data-meter="neutral"><div class="meter-head"><span>NEUTRAL BASELINE</span><strong id="neutral-count">0 / 45</strong></div><div class="track"><i id="neutral-bar"></i></div></div>
          <div class="meter" data-meter="next"><div class="meter-head"><span>NEXT / ADVANCE</span><strong id="next-count">0 / 5</strong></div><div class="track"><i id="next-bar"></i></div></div>
          <div class="meter" data-meter="select"><div class="meter-head"><span>SELECT / CONFIRM</span><strong id="select-count">0 / 5</strong></div><div class="track"><i id="select-bar"></i></div></div>
        </div>
        <div class="controls"><button id="neutral-button" class="primary">CALIBRATE NEUTRAL <kbd>N</kbd></button><button id="next-button">TEACH NEXT <kbd>→</kbd></button><button id="select-button">TEACH SELECT <kbd>↵</kbd></button><button id="reset-button" class="ghost">RESET PROFILE</button></div>
        <div class="learning-summary"><div class="summary-title">WHAT WAS LEARNED</div><div class="summary-grid"><span>NEXT <b id="next-separability">0%</b></span><span>SELECT <b id="select-separability">0%</b></span><span>NEUTRAL <b id="neutral-learned">0 frames</b></span></div><p id="learning-message">No personalized profile yet.</p></div>
        <p class="hint" id="hint">Allow camera access to begin. The model loads from MediaPipe on first launch.</p>
      </div>
    </section>

    <section class="event-strip panel">
      <div class="panel-label"><span>03 / EVENT MONITOR</span><span>STREAM / MOTIONBRIDGE</span></div>
      <div class="event-grid"><div><span class="micro-label">LAST EMITTED COMMAND</span><strong id="last-command">—</strong></div><div><span class="micro-label">NEXT EVENTS</span><strong id="next-events">0</strong></div><div><span class="micro-label">SELECT EVENTS</span><strong id="select-events">0</strong></div></div>
      <div class="system-strip"><span>CAMERA <b id="camera-status">OFFLINE</b></span><span>FACE <b id="face-status">SEARCHING</b></span><span>SYSTEM <b id="system-status">IDLE</b></span></div>
      <details class="developer-details"><summary>Developer distances</summary><code id="raw-distances">No live vector yet.</code></details>
    </section>
    <footer><span>LOCAL DEBUG HARNESS · NOT A PRODUCT SURFACE</span><span>FEATURE VECTOR / 20 DIMENSIONS</span></footer>
  </div>
`;

const video = document.querySelector<HTMLVideoElement>("#camera")!;
const controllerState = { controller: undefined as MotionBridgeController | undefined, next: 0, select: 0 };
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

function handleCommand(event: GestureCommand): void {
  $("#last-command").textContent = event.command;
  if (event.command === "NEXT") {
    controllerState.next += 1;
    $("#next-events").textContent = String(controllerState.next);
  }
  if (event.command === "SELECT") {
    controllerState.select += 1;
    $("#select-events").textContent = String(controllerState.select);
  }
}

async function boot(): Promise<void> {
  try {
    controllerState.controller = await startMotionBridge(video, handleCommand);
    $("#run-state").innerHTML = "<span>●</span> SENSOR ARRAY ONLINE";
    $("#hint").textContent = "Start with a relaxed neutral face, then teach each movement in five deliberate samples.";
  } catch (error) {
    $("#run-state").innerHTML = "<span class='bad'>●</span> SENSOR ARRAY OFFLINE";
    $("#hint").textContent = error instanceof Error ? error.message : "Unable to initialize the camera or face model.";
  }
}

$("#neutral-button").addEventListener("click", () => {
  controllerState.controller?.beginNeutralCalibration();
});
$("#next-button").addEventListener("click", () => beginGesture("NEXT"));
$("#select-button").addEventListener("click", () => beginGesture("SELECT"));
$("#reset-button").addEventListener("click", () => {
  controllerState.controller?.beginNeutralCalibration();
  controllerState.next = 0;
  controllerState.select = 0;
  $("#next-events").textContent = "0";
  $("#select-events").textContent = "0";
  $("#last-command").textContent = "—";
});

window.setInterval(() => {
  const controller = controllerState.controller;
  if (!controller) return;
  const progress = controller.getCalibrationProgress();
  const calibration = controller.getCalibrationState();
  const runtime = controller.getRuntimeStatus();
  const prediction = controller.getLatestPrediction();
  $("#prediction").textContent = prediction.label;
  $("#confidence").textContent = `${Math.round(prediction.confidence * 100)}%`;
  $("#face-state").textContent = runtime.faceDetected ? "FACE LOCK" : "SEARCHING";
  $("#ready-badge").textContent = calibration.ready ? "READY" : "NOT READY";
  $("#ready-badge").classList.toggle("ready", calibration.ready);
  const scores = prediction.classScores ?? { NEUTRAL: 0, NEXT: 0, SELECT: 0 };
  for (const label of ["NEUTRAL", "NEXT", "SELECT"] as const) {
    const key = label.toLowerCase();
    $(`#score-${key}`).style.width = `${scores[label]}%`;
    $(`#score-${key}-value`).textContent = `${scores[label]}%`;
    $(`[data-score="${label}"]`).classList.toggle("current", prediction.label === label);
  }
  renderCalibrationState(calibration, progress);
  $("#camera-status").textContent = runtime.cameraActive ? "ACTIVE" : "OFFLINE";
  $("#camera-status").className = runtime.cameraActive ? "good" : "bad";
  $("#face-status").textContent = runtime.faceDetected ? "DETECTED" : "SEARCHING";
  $("#face-status").className = runtime.faceDetected ? "good" : "muted";
  const backendReady = runtime.backendConnected !== false;
  $("#system-status").textContent = !backendReady ? "BACKEND OFFLINE" : calibration.ready ? "READY" : calibration.mode !== "IDLE" ? "CALIBRATING" : "IDLE";
  $("#system-status").className = !backendReady ? "bad" : calibration.ready ? "good" : "muted";
  if (!backendReady) $("#hint").textContent = "Camera is active, but the Python vision backend is unavailable. Start it with: python -m vision_backend.main";
  $("#raw-distances").textContent = prediction.distances
    ? Object.entries(prediction.distances).map(([label, distance]) => `${label}: ${distance.toFixed(2)}`).join("  ·  ")
    : "No live vector yet.";
  updateMeter("neutral", progress.neutral, progress.neutralRequired);
  updateMeter("next", progress.next, progress.gestureRequired);
  updateMeter("select", progress.select, progress.gestureRequired);
}, 100);

function renderCalibrationState(state: ReturnType<MotionBridgeController["getCalibrationState"]>, progress: ReturnType<MotionBridgeController["getCalibrationProgress"]>): void {
  const mode = state.mode;
  const modeLabel = mode === "NEUTRAL" ? "NEUTRAL" : mode === "IDLE" ? "IDLE" : `TEACH ${mode}`;
  $("#calibration-title").textContent = state.ready ? "CALIBRATION COMPLETE" : mode === "IDLE" ? "CALIBRATION IDLE" : mode === "NEUTRAL" ? "CALIBRATING NEUTRAL" : modeLabel;
  if (mode === "NEUTRAL") $("#calibration-instruction").textContent = `Collecting neutral frames · ${progress.neutral} / ${progress.neutralRequired}`;
  else if (mode === "NEXT" || mode === "SELECT") $("#calibration-instruction").textContent = state.phase === "WAITING_FOR_NEUTRAL" ? "Movement captured. Return to neutral to arm the next sample." : "Perform your movement, then hold it briefly.";
  else $("#calibration-instruction").textContent = state.ready ? "Ready for live recognition." : "Choose a calibration step to begin learning.";
  const activeCount = mode === "NEXT" ? progress.next : mode === "SELECT" ? progress.select : 0;
  const dots = mode === "NEXT" || mode === "SELECT" ? Array.from({ length: progress.gestureRequired }, (_, index) => index < activeCount ? "●" : "○").join(" ") : "";
  $("#sample-dots").textContent = dots ? `Samples  ${dots}  ${activeCount} / ${progress.gestureRequired}` : "";
  $("#next-separability").textContent = `${state.nextSeparability}% · ${progress.next} samples`;
  $("#select-separability").textContent = `${state.selectSeparability}% · ${progress.select} samples`;
  $("#neutral-learned").textContent = `${progress.neutral} frames`;
  $("#learning-message").textContent = state.issue ?? (state.ready ? "Personalized profile learned. Ready for live recognition." : "No personalized profile yet.");
  $("#learning-message").classList.toggle("warning", Boolean(state.issue));
}

function updateMeter(name: string, value: number, total: number): void {
  $(`#${name}-count`).textContent = `${value} / ${total}`;
  $(`#${name}-bar`).style.width = `${Math.min(100, (value / total) * 100)}%`;
}

void boot();

function beginGesture(type: "NEXT" | "SELECT"): void {
  try {
    controllerState.controller?.beginGestureCalibration(type);
  } catch (error) {
    $("#hint").textContent = error instanceof Error ? error.message : "Complete neutral calibration first.";
  }
}
