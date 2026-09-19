# Motion-Bridge

## Vision / Gesture Recognition

The `src/vision` module owns the webcam → MediaPipe Face Landmarker → personalized gesture pipeline. It emits only the shared `GestureCommand` contract, so consumers do not need to know about MediaPipe.

```ts
import { startMotionBridge } from "./vision";

const controller = await startMotionBridge(videoElement, (event) => {
  if (event.command === "NEXT") moveToNextResult();
  if (event.command === "SELECT") selectCurrentResult();
});

controller.beginNeutralCalibration();
// After the neutral meter completes:
controller.beginGestureCalibration("NEXT");
// After the NEXT meter completes:
controller.beginGestureCalibration("SELECT");
controller.getCalibrationProgress(); // { neutral, next, select, ... }
controller.isReady();
controller.stop();
```

### Run the debug harness

```bash
python -m pip install -r requirements.txt
python -m vision_backend.main
```

In a second terminal:

```bash
npm install
npm run dev
```

Open the Vite URL over `localhost` (or HTTPS), allow camera access, and use the calibration buttons. The browser keeps ownership of the webcam and sends compressed frames to `ws://127.0.0.1:8000/ws/vision`; Python owns MediaPipe, OpenCV, calibration, scikit-learn classification, and temporal events. The Face Landmarker `.task` model is downloaded on first backend use; set `MOTIONBRIDGE_FACE_MODEL` to a local copy for offline startup.

Calibration collects 80 neutral frames, then five movement windows per gesture. Each window starts after standardized movement crosses `MOTIONBRIDGE_MOVEMENT_START`, lasts 300–600 ms, and requires return below `MOTIONBRIDGE_NEUTRAL_RETURN` before the next repetition. Quality, confidence, stability, and cooldown can be tuned with the `MOTIONBRIDGE_*` variables in `vision_backend/config.py`.

```bash
npm test
npm run build
python -m pytest -q
```
