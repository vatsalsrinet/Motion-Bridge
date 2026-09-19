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
        <div class="prediction-row"><div><span class="micro-label">CURRENT PREDICTION</span><strong id="prediction">UNKNOWN</strong></div><div class="confidence"><span class="micro-label">CONFIDENCE</span><strong id="confidence">0%</strong></div></div>
      </div>

      <div class="calibration-card panel">
        <div class="panel-label"><span>02 / PERSONAL PROFILE</span><span id="ready-badge" class="badge">NOT READY</span></div>
        <div class="meters">
          <div class="meter" data-meter="neutral"><div class="meter-head"><span>NEUTRAL BASELINE</span><strong id="neutral-count">0 / 45</strong></div><div class="track"><i id="neutral-bar"></i></div></div>
          <div class="meter" data-meter="next"><div class="meter-head"><span>NEXT / ADVANCE</span><strong id="next-count">0 / 5</strong></div><div class="track"><i id="next-bar"></i></div></div>
          <div class="meter" data-meter="select"><div class="meter-head"><span>SELECT / CONFIRM</span><strong id="select-count">0 / 5</strong></div><div class="track"><i id="select-bar"></i></div></div>
        </div>
        <div class="controls"><button id="neutral-button" class="primary">CALIBRATE NEUTRAL <kbd>N</kbd></button><button id="next-button">TEACH NEXT <kbd>→</kbd></button><button id="select-button">TEACH SELECT <kbd>↵</kbd></button><button id="reset-button" class="ghost">RESET PROFILE</button></div>
        <p class="hint" id="hint">Allow camera access to begin. The model loads from MediaPipe on first launch.</p>
      </div>
    </section>

    <section class="event-strip panel">
      <div class="panel-label"><span>03 / EVENT MONITOR</span><span>STREAM / MOTIONBRIDGE</span></div>
      <div class="event-grid"><div><span class="micro-label">LAST EMITTED COMMAND</span><strong id="last-command">—</strong></div><div><span class="micro-label">NEXT EVENTS</span><strong id="next-events">0</strong></div><div><span class="micro-label">SELECT EVENTS</span><strong id="select-events">0</strong></div></div>
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

$("#neutral-button").addEventListener("click", () => controllerState.controller?.beginNeutralCalibration());
$("#next-button").addEventListener("click", () => controllerState.controller?.beginGestureCalibration("NEXT"));
$("#select-button").addEventListener("click", () => controllerState.controller?.beginGestureCalibration("SELECT"));
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
  const prediction = controller.getLatestPrediction();
  $("#prediction").textContent = prediction.label;
  $("#confidence").textContent = `${Math.round(prediction.confidence * 100)}%`;
  $("#face-state").textContent = prediction.label === "UNKNOWN" ? "SEARCHING" : "FACE LOCK";
  $("#ready-badge").textContent = controller.isReady() ? "READY" : "NOT READY";
  $("#ready-badge").classList.toggle("ready", controller.isReady());
  updateMeter("neutral", progress.neutral, progress.neutralRequired);
  updateMeter("next", progress.next, progress.gestureRequired);
  updateMeter("select", progress.select, progress.gestureRequired);
}, 100);

function updateMeter(name: string, value: number, total: number): void {
  $(`#${name}-count`).textContent = `${value} / ${total}`;
  $(`#${name}-bar`).style.width = `${Math.min(100, (value / total) * 100)}%`;
}

void boot();
