import { startMockMotionBridge } from "../mocks/mockMotionBridge";
import type { StartMotionBridge } from "../types/motionBridge";

/**
 * Integration point for Person 1.
 *
 * Their module registers itself once at startup:
 *
 *   import { registerMotionBridge } from "../vision/motionBridge";
 *   import { startMotionBridge } from "./vision";
 *   registerMotionBridge(startMotionBridge);
 *
 * Until that happens every calibration screen transparently drives the mock, so
 * the frontend never has a broken build waiting on the vision work.
 */

let registered: StartMotionBridge | null = null;

export const registerMotionBridge = (start: StartMotionBridge): void => {
  registered = start;
};

export const isMotionBridgeRegistered = (): boolean => registered !== null;

export const getMotionBridge = (): StartMotionBridge => registered ?? startMockMotionBridge;
