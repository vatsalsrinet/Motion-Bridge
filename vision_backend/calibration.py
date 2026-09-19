from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Literal

import numpy as np

from .config import DEFAULT_CONFIG, VisionConfig

Gesture = Literal["NEXT", "SELECT"]


@dataclass(frozen=True)
class CalibrationStatus:
    mode: str
    phase: str
    neutral_current: int
    neutral_required: int
    next_current: int
    select_current: int
    gesture_required: int
    next_quality: int
    select_quality: int
    ready: bool
    issue: str | None


class CalibrationManager:
    """Collects neutral statistics and one temporal window per deliberate gesture."""

    def __init__(self, config: VisionConfig = DEFAULT_CONFIG) -> None:
        self.config = config
        self.reset()

    def reset(self) -> None:
        self.mode: str = "IDLE"
        self.phase: str = "IDLE"
        self.neutral_samples: list[np.ndarray] = []
        self.gesture_samples: dict[Gesture, list[np.ndarray]] = {"NEXT": [], "SELECT": []}
        self.neutral_mean: np.ndarray | None = None
        self.neutral_std: np.ndarray | None = None
        self._window: list[np.ndarray] = []
        self._window_started: float | None = None

    def begin(self, gesture: str) -> None:
        if gesture == "NEUTRAL":
            self.reset()
            self.mode = "NEUTRAL"
            self.phase = "COLLECTING"
            return
        if gesture not in ("NEXT", "SELECT"):
            raise ValueError("gesture must be NEUTRAL, NEXT, or SELECT")
        if not self.neutral_complete:
            raise ValueError("Complete neutral calibration before teaching a gesture")
        self.gesture_samples[gesture] = []
        self.mode = gesture
        self.phase = "COLLECTING"
        self._window = []
        self._window_started = None

    @property
    def neutral_complete(self) -> bool:
        return len(self.neutral_samples) >= self.config.neutral_frames and self.neutral_mean is not None

    def observe(self, vector: np.ndarray, timestamp: float | None = None) -> bool:
        vector = self._validate(vector)
        now = timestamp if timestamp is not None else time.monotonic()
        if self.mode == "NEUTRAL":
            if len(self.neutral_samples) < self.config.neutral_frames:
                self.neutral_samples.append(vector.copy())
                self._recalculate_baseline()
            if self.neutral_complete:
                self.mode, self.phase = "IDLE", "IDLE"
            return False
        if self.mode not in ("NEXT", "SELECT") or not self.neutral_complete:
            return False

        normalized = self.normalize(vector)
        movement = float(np.sqrt(np.mean(normalized * normalized)))
        if self.phase == "COLLECTING":
            if movement >= self.config.movement_start_rms:
                self._window = [normalized]
                self._window_started = now
                self.phase = "WINDOW"
            return False
        if self.phase == "WINDOW":
            self._window.append(normalized)
            elapsed = now - (self._window_started if self._window_started is not None else now)
            if elapsed >= self.config.sample_window_min_s and (
                movement <= self.config.neutral_return_rms or elapsed >= self.config.sample_window_max_s
            ):
                self.gesture_samples[self.mode].append(np.mean(self._window, axis=0))
                self._window = []
                self._window_started = None
                self.phase = "WAITING_FOR_NEUTRAL"
                return True
            return False
        if self.phase == "WAITING_FOR_NEUTRAL" and movement <= self.config.neutral_return_rms:
            if len(self.gesture_samples[self.mode]) >= self.config.gesture_repetitions:
                self.mode, self.phase = "IDLE", "IDLE"
            else:
                self.phase = "COLLECTING"
        return False

    def normalize(self, vector: np.ndarray) -> np.ndarray:
        vector = self._validate(vector)
        if self.neutral_mean is None or self.neutral_std is None:
            raise ValueError("Neutral calibration is incomplete")
        if vector.shape != self.neutral_mean.shape:
            raise ValueError("Feature vector shape changed")
        return (vector - self.neutral_mean) / self.neutral_std

    def training_data(self) -> tuple[np.ndarray, np.ndarray]:
        if not self.neutral_complete:
            raise ValueError("Neutral calibration is incomplete")
        if not self.gesture_samples["NEXT"] or not self.gesture_samples["SELECT"]:
            raise ValueError("Both gesture classes need samples")
        neutral = np.asarray([self.normalize(sample) for sample in self.neutral_samples], dtype=np.float32)
        next_samples = np.asarray(self.gesture_samples["NEXT"], dtype=np.float32)
        select_samples = np.asarray(self.gesture_samples["SELECT"], dtype=np.float32)
        return np.concatenate((neutral, next_samples, select_samples)), np.asarray(
            ["NEUTRAL"] * len(neutral) + ["NEXT"] * len(next_samples) + ["SELECT"] * len(select_samples),
        )

    def quality(self, gesture: Gesture) -> int:
        own = self._centroid(gesture)
        other = self._centroid("SELECT" if gesture == "NEXT" else "NEXT")
        if own is None or other is None:
            return 0
        boundary = min(float(np.linalg.norm(own)), float(np.linalg.norm(own - other)))
        return int(np.clip(boundary / 4.0 * 100.0, 0, 100))

    @property
    def ready(self) -> bool:
        return (
            self.neutral_complete
            and len(self.gesture_samples["NEXT"]) >= self.config.gesture_repetitions
            and len(self.gesture_samples["SELECT"]) >= self.config.gesture_repetitions
            and self.quality("NEXT") >= self.config.quality_threshold
            and self.quality("SELECT") >= self.config.quality_threshold
        )

    def status(self) -> CalibrationStatus:
        enough = len(self.gesture_samples["NEXT"]) >= self.config.gesture_repetitions and len(self.gesture_samples["SELECT"]) >= self.config.gesture_repetitions
        issue = "NEXT and SELECT are too similar. Please recalibrate SELECT." if enough and not self.ready else None
        return CalibrationStatus(
            mode=self.mode,
            phase=self.phase,
            neutral_current=len(self.neutral_samples),
            neutral_required=self.config.neutral_frames,
            next_current=len(self.gesture_samples["NEXT"]),
            select_current=len(self.gesture_samples["SELECT"]),
            gesture_required=self.config.gesture_repetitions,
            next_quality=self.quality("NEXT"),
            select_quality=self.quality("SELECT"),
            ready=self.ready,
            issue=issue,
        )

    def _recalculate_baseline(self) -> None:
        if not self.neutral_samples:
            return
        matrix = np.asarray(self.neutral_samples, dtype=np.float32)
        self.neutral_mean = np.mean(matrix, axis=0)
        self.neutral_std = np.maximum(np.std(matrix, axis=0), 0.1).astype(np.float32)

    def _centroid(self, gesture: Gesture) -> np.ndarray | None:
        samples = self.gesture_samples[gesture]
        return np.mean(samples, axis=0) if samples else None

    @staticmethod
    def _validate(vector: np.ndarray) -> np.ndarray:
        array = np.asarray(vector, dtype=np.float32).reshape(-1)
        if array.size == 0 or not np.isfinite(array).all():
            raise ValueError("Feature vector must be finite and non-empty")
        return array
