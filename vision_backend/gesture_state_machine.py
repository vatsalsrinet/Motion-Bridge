from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import time

from .classifier import Prediction


@dataclass(frozen=True)
class GestureEvent:
    command: str
    confidence: int


class GestureStateMachine:
    def __init__(self, stable_s: float = 0.25, cooldown_s: float = 0.70) -> None:
        self.stable_s = stable_s
        self.cooldown_s = cooldown_s
        self.history: deque[tuple[float, Prediction]] = deque(maxlen=5)
        self.candidate: str | None = None
        self.candidate_started: float | None = None
        self.last_triggered = float("-inf")
        self.waiting_for_neutral = False

    def reset(self) -> None:
        self.history.clear()
        self.candidate = None
        self.candidate_started = None
        self.last_triggered = float("-inf")
        self.waiting_for_neutral = False

    def update(self, prediction: Prediction, timestamp: float | None = None) -> GestureEvent | None:
        now = timestamp if timestamp is not None else time.monotonic()
        self.history.append((now, prediction))
        if self.waiting_for_neutral:
            if prediction.label == "NEUTRAL" and now - self.last_triggered >= self.cooldown_s:
                self.waiting_for_neutral = False
                self.candidate = None
                self.candidate_started = None
                return GestureEvent("NEUTRAL", prediction.confidence)
            return None
        if prediction.label not in ("NEXT", "SELECT"):
            self.candidate = None
            self.candidate_started = None
            return None
        # At 10–15 FPS a 200–300 ms stability window may only contain two
        # frames, so allow one additional frame for transport jitter.
        recent_window = max(self.stable_s * 2.0, 0.35)
        recent = [item for item in self.history if now - item[0] <= recent_window]
        same = [item for item in recent if item[1].label == prediction.label and item[1].confidence >= 62]
        if len(same) < 2:
            return None
        if self.candidate != prediction.label:
            self.candidate = prediction.label
            self.candidate_started = now
            return None
        if now - (self.candidate_started or now) < self.stable_s:
            return None
        self.last_triggered = now
        self.waiting_for_neutral = True
        self.candidate = None
        self.candidate_started = None
        return GestureEvent(prediction.label, prediction.confidence)
