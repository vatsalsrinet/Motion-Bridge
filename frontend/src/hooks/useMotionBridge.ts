import { useCallback, useEffect, useRef, useState } from "react";
import { appController } from "../app/AppController";
import { getMotionBridge, isMotionBridgeRegistered } from "../vision/motionBridge";
import type { GestureType } from "../types/contracts";
import type { MotionBridgeController } from "../types/motionBridge";

/**
 * Starts Person 1's module (or the mock) against a video element and wires
 * every emitted GestureCommand into AppController.handleGesture.
 *
 * One instance for the whole app: started when the camera first appears and
 * kept alive across calibration screens so prototypes are not lost.
 */
export const useMotionBridge = (videoElement: HTMLVideoElement | null) => {
  const controllerRef = useRef<MotionBridgeController | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoElement || controllerRef.current) return;

    let cancelled = false;

    const start = async () => {
      try {
        const controller = await getMotionBridge()(videoElement, appController.handleGesture);
        if (cancelled) {
          controller.stop();
          return;
        }

        controller.onCalibrationProgress?.((progress) => {
          appController.updateSampleProgress(progress.captured, progress.required);
          if (progress.complete) {
            appController.completeCalibrationStage(progress.stage);
          }
        });

        controllerRef.current = controller;
        setStarted(true);
      } catch (cause) {
        if (cancelled) return;
        const message =
          cause instanceof Error ? cause.message : "The movement tracker failed to start.";
        setError(message);
        appController.showCalibrationError(message);
      }
    };

    void start();

    return () => {
      cancelled = true;
    };
  }, [videoElement]);

  // Tear the tracker down when the app unmounts, releasing the model and camera.
  useEffect(
    () => () => {
      controllerRef.current?.stop();
      controllerRef.current = null;
    },
    []
  );

  const beginNeutralCalibration = useCallback(() => {
    controllerRef.current?.beginNeutralCalibration();
  }, []);

  const beginGestureCalibration = useCallback((type: GestureType) => {
    controllerRef.current?.beginGestureCalibration(type);
  }, []);

  const readScores = useCallback(() => {
    const scores = controllerRef.current?.getCalibrationScores?.();
    if (scores) appController.setCalibrationScores(scores);
  }, []);

  return {
    started,
    error,
    usingMock: !isMotionBridgeRegistered(),
    beginNeutralCalibration,
    beginGestureCalibration,
    readScores
  };
};
