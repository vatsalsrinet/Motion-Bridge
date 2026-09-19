import { useSyncExternalStore } from "react";
import { appController } from "../app/AppController";
import type { AppState } from "../app/AppController";

/** Subscribes React to the framework-free AppController store. */
export const useAppState = (): AppState =>
  useSyncExternalStore(appController.subscribe, appController.getState, appController.getState);

export { appController };
