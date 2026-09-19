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
controller.beginGestureCalibration("SELECT");
controller.getCalibrationProgress(); // { neutral, next, select, ... }
controller.isReady();
controller.stop();
```

### Run the debug harness

```bash
npm install
npm run dev
```

Open the Vite URL over `localhost` (or HTTPS), allow camera access, and use the calibration buttons. The Face Landmarker model and WASM runtime default to MediaPipe's hosted assets; pass `modelAssetPath` and `wasmBasePath` to `startMotionBridge` to serve them locally.

```bash
npm test
npm run build
```
